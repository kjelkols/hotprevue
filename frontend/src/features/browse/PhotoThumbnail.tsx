import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { PhotoListItem } from '../../types/api'
import { updateCorrection } from '../../api/photos'
import { removePhotosFromStacks } from '../../api/stacks'
import { getBaseUrl } from '../../api/client'
import useSelectionStore from '../../stores/useSelectionStore'
import useContextMenuStore from '../../stores/useContextMenuStore'
import useAssignmentStore from '../../stores/useAssignmentStore'
import usePhotoNavStore from '../../stores/usePhotoNavStore'
import ThumbnailShell from '../../components/ui/ThumbnailShell'
import PhotoCorrectionDialog from '../photos/PhotoCorrectionDialog'

function formatDate(taken_at: string | null): string {
  if (!taken_at) return 'Ukjent dato'
  const d = new Date(taken_at)
  const dd = String(d.getDate()).padStart(2, '0')
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${dd}.${mm}.${yy}`
}

const actionBtn = 'w-6 h-6 rounded bg-black/75 text-white text-base leading-none hover:bg-black/90 flex items-center justify-center'

interface Props {
  photo: PhotoListItem
  orderedHashes: string[]
  onToggleStack?: (stackId: string) => void
  isStackExpanded?: boolean
}

export default function PhotoThumbnail({ photo, orderedHashes, onToggleStack, isStackExpanded }: Props) {
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
  const removeFromStackMut = useMutation({
    mutationFn: (hothashes: string[]) => removePhotosFromStacks(hothashes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photos'] })
      qc.invalidateQueries({ queryKey: ['stacks'] })
    },
  })

  function rotateCCW(e: React.MouseEvent) {
    e.stopPropagation()
    const next = ((photo.rotation ?? 0) - 90 + 360) % 360
    rotateMut.mutate(next || null)
  }
  function rotateCW(e: React.MouseEvent) {
    e.stopPropagation()
    const next = ((photo.rotation ?? 0) + 90) % 360
    rotateMut.mutate(next || null)
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
      const selectedHashes = Array.from(useSelectionStore.getState().selected)
      openContextMenu({
        position: { x: e.clientX, y: e.clientY },
        items: [
          { id: 'event',      label: `Sett event… (${selectedCount})`,        action: () => openAssignment('event') },
          { id: 'collection', label: `Legg til i samling… (${selectedCount})`, action: () => openAssignment('collection') },
          { id: 'tag',        label: `Legg til tag… (${selectedCount})`,       action: () => openAssignment('tag') },
          { id: 'stack',      label: `Opprett stack (${selectedCount})`,       action: () => openAssignment('stack') },
          { id: 'unstack',    label: `Fjern fra stack (${selectedCount})`,     action: () => removeFromStackMut.mutate(selectedHashes) },
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
        { id: 'open',    label: 'Åpne',                isDefault: true, action: () => navigate(`/photos/${photo.hothash}`) },
        { id: 'correct', label: 'Korriger bilde…',     action: () => setCorrectionOpen(true) },
        { id: 'download', label: 'Last ned (full)',     action: () => { window.location.href = `${getBaseUrl()}/photos/${photo.hothash}/download` } },
        { type: 'separator' },
        { id: 'event',      label: 'Sett event…',         action: () => openAssignment('event') },
        { id: 'collection', label: 'Legg til i samling…', action: () => openAssignment('collection') },
        { id: 'tag',        label: 'Legg til tag…',       action: () => openAssignment('tag') },
        ...(photo.stack_id ? [{ id: 'unstack', label: 'Fjern fra stack', action: () => removeFromStackMut.mutate([photo.hothash]) }] : []),
      ],
    })
  }

  const isStackCover = photo.is_stack_cover && !!photo.stack_id

  const stackIndicator = isStackCover ? (
    <button
      onClick={e => { e.stopPropagation(); onToggleStack?.(photo.stack_id!) }}
      title={isStackExpanded ? 'Lukk stack' : 'Åpne stack'}
      className="absolute bottom-1 right-1 flex items-center gap-0.5 bg-black/75 hover:bg-black/90 text-white text-[10px] px-1.5 py-0.5 rounded z-10"
    >
      <svg viewBox="0 0 16 16" className="w-3 h-3 fill-current" aria-hidden>
        <rect x="1" y="9" width="14" height="2.5" rx="1" />
        <rect x="2" y="5.5" width="12" height="2.5" rx="1" />
        <rect x="3" y="2" width="10" height="2.5" rx="1" />
      </svg>
    </button>
  ) : null

  const rotateActions = (
    <>
      <button onClick={rotateCCW} title="Rotér mot klokken" className={actionBtn}>↺</button>
      <button onClick={rotateCW}  title="Rotér med klokken" className={actionBtn}>↻</button>
    </>
  )

  return (
    <>
      <div className="relative">
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
        {stackIndicator}
      </div>
      <PhotoCorrectionDialog
        hothash={photo.hothash}
        open={correctionOpen}
        onOpenChange={setCorrectionOpen}
      />
    </>
  )
}

