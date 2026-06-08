import { useState, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { QueryClient } from '@tanstack/react-query'
import type { PhotoListItem } from '../../types/api'
import { updateCorrection } from '../../api/photos'
import { createStack, addPhotosToStackBatch, removePhotosFromStacks, dissolveStack } from '../../api/stacks'
import { getBaseUrl } from '../../api/client'
import useSelectionStore from '../../stores/useSelectionStore'
import useContextMenuStore from '../../stores/useContextMenuStore'
import useAssignmentStore from '../../stores/useAssignmentStore'
import usePhotoNavStore from '../../stores/usePhotoNavStore'
import ThumbnailShell from '../../components/ui/ThumbnailShell'
import PhotoCorrectionDialog from '../photos/PhotoCorrectionDialog'
import PhotoTooltip from './PhotoTooltip'

function formatDate(taken_at: string | null): string {
  if (!taken_at) return 'Ukjent dato'
  const d = new Date(taken_at)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

function getPhotosFromCache(qc: QueryClient, hothashes: Set<string>): PhotoListItem[] {
  const found = new Map<string, PhotoListItem>()
  const queries = qc.getQueriesData<{ pages: PhotoListItem[][] }>({ queryKey: ['photos'] })
  for (const [, data] of queries) {
    if (!data?.pages) continue
    for (const page of data.pages) {
      for (const photo of page) {
        if (hothashes.has(photo.hothash)) found.set(photo.hothash, photo)
      }
    }
  }
  return Array.from(found.values())
}

function analyzeStackSelection(photos: PhotoListItem[]) {
  const free    = photos.filter(p => !p.stack_id)
  const covers  = photos.filter(p => p.stack_id && p.is_stack_cover)
  const members = photos.filter(p => p.stack_id && !p.is_stack_cover)
  const uniqueStacks = new Set(covers.map(p => p.stack_id))
  return {
    canCreateStack:      free.length >= 2 && covers.length === 0 && members.length === 0,
    canAddToStack:       free.length >= 1 && covers.length === 1 && members.length === 0,
    targetStackId:       covers.length === 1 ? covers[0].stack_id! : null,
    freeHashes:          free.map(p => p.hothash),
    canDissolve:         covers.length >= 1 && free.length === 0 && members.length === 0 && uniqueStacks.size === 1,
    canRemoveFromStack:  members.length >= 1 && covers.length === 0 && free.length === 0,
    memberHashes:        members.map(p => p.hothash),
  }
}

const actionBtn = 'w-6 h-6 rounded bg-black/75 text-white text-base leading-none hover:bg-black/90 flex items-center justify-center'

interface Props {
  photo: PhotoListItem
  orderedHashes: string[]
  stackCount?: number
  stackColor?: string
}

export default function PhotoThumbnail({ photo, orderedHashes, stackCount, stackColor }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const [correctionOpen, setCorrectionOpen] = useState(false)

  const selectOnly = useSelectionStore(s => s.selectOnly)
  const toggleOne = useSelectionStore(s => s.toggleOne)
  const selectRange = useSelectionStore(s => s.selectRange)
  const isSelected = useSelectionStore(s => s.selected.has(photo.hothash))
  const selectedCount = useSelectionStore(s => s.selected.size)
  const openContextMenu = useContextMenuStore(s => s.openContextMenu)
  const openAssignment = useAssignmentStore(s => s.open)
  const setHothashes = usePhotoNavStore(s => s.setHothashes)
  const setBackUrl = usePhotoNavStore(s => s.setBackUrl)
  const qc = useQueryClient()

  const rotateMut = useMutation({
    mutationFn: (rotation: number | null) => updateCorrection(photo.hothash, { rotation }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['photos'] }),
  })

  function invalidateStacks() {
    qc.invalidateQueries({ queryKey: ['photos'] })
    qc.invalidateQueries({ queryKey: ['stacks'] })
  }

  const createStackMut       = useMutation({ mutationFn: (h: string[]) => createStack(h),                                           onSuccess: () => { invalidateStacks(); useSelectionStore.getState().clear() } })
  const addToStackMut        = useMutation({ mutationFn: ({ stackId, hothashes }: { stackId: string; hothashes: string[] }) => addPhotosToStackBatch(stackId, hothashes), onSuccess: () => { invalidateStacks(); useSelectionStore.getState().clear() } })
  const removeFromStackMut   = useMutation({ mutationFn: (h: string[]) => removePhotosFromStacks(h),                                 onSuccess: invalidateStacks })
  const dissolveMut          = useMutation({ mutationFn: (h: string[]) => dissolveStack(h),                                          onSuccess: invalidateStacks })

  function rotateCCW(e: React.MouseEvent) {
    e.stopPropagation()
    rotateMut.mutate(((photo.rotation ?? 0) - 90 + 360) % 360 || null)
  }
  function rotateCW(e: React.MouseEvent) {
    e.stopPropagation()
    rotateMut.mutate(((photo.rotation ?? 0) + 90) % 360 || null)
  }

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (e.shiftKey) selectRange(photo.hothash, orderedHashes)
    else if (e.ctrlKey || e.metaKey) toggleOne(photo.hothash)
    else selectOnly(photo.hothash)
  }

  function handleDoubleClick() {
    setHothashes(orderedHashes)
    setBackUrl(location.pathname + location.search)
    navigate(`/photos/${photo.hothash}`)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()

    if (isSelected && selectedCount > 1) {
      const selected = useSelectionStore.getState().selected
      const selectedHashes = Array.from(selected)
      const selectedPhotos = getPhotosFromCache(qc, selected)
      const a = analyzeStackSelection(selectedPhotos)

      openContextMenu({
        position: { x: e.clientX, y: e.clientY },
        items: [
          { id: 'event',      label: `Sett event… (${selectedCount})`,        action: () => openAssignment('event') },
          { id: 'collection', label: `Legg til i samling… (${selectedCount})`, action: () => openAssignment('collection') },
          { id: 'tag',        label: `Legg til tag… (${selectedCount})`,       action: () => openAssignment('tag') },
          { type: 'separator' },
          { id: 'stack-create',  label: `Opprett stack (${selectedCount})`, disabled: !a.canCreateStack,     action: () => createStackMut.mutate(selectedHashes) },
          { id: 'stack-add',     label: 'Legg til i stack',                  disabled: !a.canAddToStack,      action: () => a.targetStackId && addToStackMut.mutate({ stackId: a.targetStackId, hothashes: a.freeHashes }) },
          { id: 'stack-remove',  label: 'Fjern fra stack',                   disabled: !a.canRemoveFromStack, action: () => removeFromStackMut.mutate(a.memberHashes) },
          { id: 'stack-dissolve',label: 'Oppløs stack',                      disabled: !a.canDissolve,        action: () => dissolveMut.mutate(selectedHashes) },
          { type: 'separator' },
          { id: 'open', label: 'Åpne dette bildet', action: () => navigate(`/photos/${photo.hothash}`) },
        ],
      })
      return
    }

    if (!isSelected) selectOnly(photo.hothash)
    openContextMenu({
      position: { x: e.clientX, y: e.clientY },
      items: [
        { id: 'open',     label: 'Åpne',             isDefault: true, action: () => navigate(`/photos/${photo.hothash}`) },
        { id: 'correct',  label: 'Korriger bilde…',  action: () => setCorrectionOpen(true) },
        { id: 'download', label: 'Last ned (full)',   action: () => { window.location.href = `${getBaseUrl()}/photos/${photo.hothash}/download` } },
        { type: 'separator' },
        { id: 'event',      label: 'Sett event…',         action: () => openAssignment('event') },
        { id: 'collection', label: 'Legg til i samling…', action: () => openAssignment('collection') },
        { id: 'tag',        label: 'Legg til tag…',       action: () => openAssignment('tag') },
        ...(photo.stack_id && !photo.is_stack_cover
          ? [{ id: 'stack-remove',  label: 'Fjern fra stack', action: () => removeFromStackMut.mutate([photo.hothash]) }]
          : []),
        ...(photo.stack_id && photo.is_stack_cover
          ? [{ id: 'stack-dissolve', label: 'Oppløs stack',   action: () => dissolveMut.mutate([photo.hothash]) }]
          : []),
      ],
    })
  }

  const isStackCover = photo.is_stack_cover && !!photo.stack_id
  const showCardDeck = isStackCover && !stackColor
  const showStackBadge = isStackCover && !stackColor && stackCount != null
  const thumbRef = useRef<HTMLDivElement>(null)
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [tooltipAnchor, setTooltipAnchor] = useState<DOMRect | null>(null)

  function handleMouseEnter() {
    hoverTimer.current = setTimeout(() => {
      if (thumbRef.current) setTooltipAnchor(thumbRef.current.getBoundingClientRect())
    }, 350)
  }

  function handleMouseLeave() {
    if (hoverTimer.current) clearTimeout(hoverTimer.current)
    setTooltipAnchor(null)
  }

  const rotateActions = (
    <>
      <button onClick={rotateCCW} title="Rotér mot klokken" className={actionBtn}>↺</button>
      <button onClick={rotateCW}  title="Rotér med klokken" className={actionBtn}>↻</button>
    </>
  )

  return (
    <>
      <div
        ref={thumbRef}
        className={`relative ${stackColor ? `ring-2 ${stackColor} rounded` : ''}`}
        style={{ overflow: 'visible' }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {showCardDeck && (
          <>
            <div className="absolute inset-0 rounded bg-gray-600" style={{ transform: 'translate(5px, 4px) rotate(2deg)', zIndex: 0 }} />
            <div className="absolute inset-0 rounded bg-gray-700" style={{ transform: 'translate(2.5px, 2px) rotate(1deg)', zIndex: 1 }} />
          </>
        )}
        <div style={{ position: 'relative', zIndex: 2 }}>
          <ThumbnailShell
            imageData={photo.hotpreview_b64}
            isSelected={isSelected}
            correction={photo.has_correction ? photo : null}
            actions={rotateActions}
            onClick={handleClick}
            onDoubleClick={handleDoubleClick}
            onContextMenu={handleContextMenu}
            bottomOverlay={formatDate(photo.taken_at)}
          />
          {showStackBadge && (
            <div className="absolute top-1 right-1 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded z-10 pointer-events-none">
              ×{stackCount}
            </div>
          )}
          {stackColor && photo.is_stack_cover && (
            <div className="absolute top-1 left-1 bg-black/80 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded z-10 pointer-events-none">
              Cover
            </div>
          )}
        </div>
        {tooltipAnchor && (
          <PhotoTooltip photo={photo} anchorRect={tooltipAnchor} stackCount={stackCount} />
        )}
      </div>
      <PhotoCorrectionDialog
        hothash={photo.hothash}
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
      />
    </>
  )
}
