import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AGENT_URL } from '../../api/agentClient'
import { getExif } from '../../api/prescan'
import { deleteGroup, rotateImage } from '../../api/fileops'
import type { PrescanFileEntry } from '../../types/api'

interface Props {
  files: PrescanFileEntry[]
  index: number
  onNavigate: (i: number) => void
  onClose: () => void
  onDeleted: (path: string) => void
  onRotated: (filePath: string, result: { hotpreview_b64: string; hothash: string; orientation: number }) => void
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'medium', timeStyle: 'short' })
}

function formatBytes(n: number | null): string {
  if (n == null) return '—'
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

export default function PreviewLightbox({ files, index, onNavigate, onClose, onDeleted, onRotated }: Props) {
  const file = files[index]
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [imgVersion, setImgVersion] = useState(0)

  // Zoom/pan state
  const [scale, setScale] = useState(1)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const dragRef = useRef<{ startX: number; startY: number; ox: number; oy: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const src = `${AGENT_URL}/process/preview?path=${encodeURIComponent(file.file_path)}&maxpx=1600${imgVersion > 0 ? `&v=${imgVersion}` : ''}`

  const { data: exif } = useQuery({
    queryKey: ['exif', file.file_path],
    queryFn: () => getExif(file.file_path),
    staleTime: 60_000,
  })

  // Reset zoom when navigating
  useEffect(() => {
    setScale(1)
    setOffset({ x: 0, y: 0 })
    setConfirmDelete(false)
    setImgVersion(0)
  }, [index])

  // Non-passive wheel listener for zoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15
      setScale(prev => {
        const next = Math.max(1, Math.min(12, prev * factor))
        const rect = el!.getBoundingClientRect()
        const cx = e.clientX - rect.left - rect.width / 2
        const cy = e.clientY - rect.top - rect.height / 2
        const ratio = next / prev
        setOffset(o => ({
          x: o.x * ratio + cx * (1 - ratio),
          y: o.y * ratio + cy * (1 - ratio),
        }))
        return next
      })
    }

    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Keyboard
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (confirmDelete) setConfirmDelete(false)
        else if (scale > 1) { setScale(1); setOffset({ x: 0, y: 0 }) }
        else onClose()
      }
      if (e.key === 'ArrowLeft'  && index > 0)               onNavigate(index - 1)
      if (e.key === 'ArrowRight' && index < files.length - 1) onNavigate(index + 1)
      if (e.key === 'Delete') setConfirmDelete(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, files.length, confirmDelete, scale])

  function handleMouseDown(e: React.MouseEvent) {
    if (scale <= 1) return
    e.preventDefault()
    dragRef.current = { startX: e.clientX, startY: e.clientY, ox: offset.x, oy: offset.y }
  }

  function handleMouseMove(e: React.MouseEvent) {
    if (!dragRef.current) return
    setOffset({
      x: dragRef.current.ox + e.clientX - dragRef.current.startX,
      y: dragRef.current.oy + e.clientY - dragRef.current.startY,
    })
  }

  function handleMouseUp() { dragRef.current = null }

  function handleDoubleClick() {
    setScale(1)
    setOffset({ x: 0, y: 0 })
  }

  async function handleRotate(direction: 'cw' | 'ccw') {
    if (rotating) return
    setRotating(true)
    try {
      const result = await rotateImage(file.file_path, direction)
      onRotated(file.file_path, result)
      setScale(1)
      setOffset({ x: 0, y: 0 })
      setImgVersion(v => v + 1)
    } finally {
      setRotating(false)
    }
  }

  async function handleDelete() {
    setDeleting(true)
    try {
      await deleteGroup(file.file_path)
      onDeleted(file.file_path)
    } catch {
      setDeleting(false)
      setConfirmDelete(false)
    }
  }

  const isDragging = !!dragRef.current
  const filename = file.file_path.split(/[\\/]/).pop() ?? ''

  return (
    <div className="fixed inset-0 z-50 flex bg-black/95">

      {/* Bildeområde */}
      <div
        ref={containerRef}
        className="relative flex flex-1 items-center justify-center overflow-hidden"
        style={{ cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onDoubleClick={handleDoubleClick}
        onClick={scale === 1 ? (e => { if (e.target === e.currentTarget) onClose() }) : undefined}
      >
        {/* Forrige */}
        <button
          onClick={e => { e.stopPropagation(); onNavigate(index - 1) }}
          disabled={index === 0}
          className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white text-xl hover:bg-black/80 disabled:opacity-20"
        >
          ‹
        </button>

        <img
          key={file.file_path}
          src={src}
          alt={filename}
          draggable={false}
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
            transformOrigin: 'center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
            maxHeight: '100%',
            maxWidth: '100%',
            objectFit: 'contain',
            userSelect: 'none',
          }}
          onClick={e => e.stopPropagation()}
        />

        {/* Neste */}
        <button
          onClick={e => { e.stopPropagation(); onNavigate(index + 1) }}
          disabled={index === files.length - 1}
          className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white text-xl hover:bg-black/80 disabled:opacity-20"
        >
          ›
        </button>

        {/* Teller + zoom-info */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-3 rounded-full bg-black/50 px-3 py-1 text-xs text-gray-300">
          <span>{index + 1} / {files.length}</span>
          {scale > 1 && <span>{Math.round(scale * 100)}%</span>}
        </div>

        {/* Lukk */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 text-lg"
        >
          ×
        </button>

        {/* Rotasjonsknapper */}
        <div className="absolute top-3 right-3 z-10 flex gap-1">
          <button
            onClick={() => handleRotate('ccw')}
            disabled={rotating}
            title="Roter mot klokken"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white text-lg hover:bg-black/80 disabled:opacity-40"
          >
            ↺
          </button>
          <button
            onClick={() => handleRotate('cw')}
            disabled={rotating}
            title="Roter med klokken"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white text-lg hover:bg-black/80 disabled:opacity-40"
          >
            ↻
          </button>
        </div>

        {/* Reset zoom */}
        {scale > 1 && (
          <button
            onClick={e => { e.stopPropagation(); setScale(1); setOffset({ x: 0, y: 0 }) }}
            className="absolute top-3 left-14 z-10 rounded-full bg-black/50 px-3 py-1 text-xs text-gray-300 hover:bg-black/80"
          >
            1:1
          </button>
        )}
      </div>

      {/* Sidefelt */}
      <aside className="flex w-64 shrink-0 flex-col border-l border-gray-800 bg-gray-950 overflow-y-auto">
        <div className="p-4 space-y-4">
          <div>
            <p className="truncate text-sm font-medium text-white" title={filename}>{filename}</p>
            {file.companions.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">+{file.companions.length} companion{file.companions.length > 1 ? 's' : ''}</p>
            )}
          </div>

          <ExifRow label="Tatt" value={formatDate(exif?.taken_at ?? file.taken_at)} />

          {(exif?.camera_make || exif?.camera_model) && (
            <ExifRow label="Kamera" value={[exif.camera_make, exif.camera_model].filter(Boolean).join(' ')} />
          )}
          {exif?.lens_model && <ExifRow label="Linse" value={exif.lens_model} />}

          {(exif?.iso || exif?.shutter_speed || exif?.aperture) && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Eksponering</p>
              <div className="grid grid-cols-3 gap-1">
                {exif?.iso        && <ExifChip label="ISO"    value={String(exif.iso)} />}
                {exif?.shutter_speed && <ExifChip label="Lukker" value={exif.shutter_speed} />}
                {exif?.aperture   && <ExifChip label="Blende" value={`f/${exif.aperture}`} />}
              </div>
              {exif?.focal_length && <p className="mt-1 text-xs text-gray-400">{exif.focal_length} mm</p>}
            </div>
          )}

          {exif?.width && exif?.height && (
            <ExifRow label="Størrelse" value={`${exif.width} × ${exif.height}`} />
          )}
          {exif?.file_size && <ExifRow label="Fil" value={formatBytes(exif.file_size)} />}
          {exif?.gps_lat != null && (
            <ExifRow label="GPS" value={`${exif.gps_lat.toFixed(5)}, ${exif.gps_lng?.toFixed(5)}`} />
          )}
        </div>

        <div className="mt-auto border-t border-gray-800 p-4">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-red-400">
                Slett {1 + file.companions.length} fil{file.companions.length > 0 ? 'er' : ''}? Dette kan ikke angres.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(false)} className="flex-1 rounded bg-gray-700 py-1.5 text-sm text-white hover:bg-gray-600">Avbryt</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 rounded bg-red-700 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50">
                  {deleting ? 'Sletter…' : 'Slett'}
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmDelete(true)} className="w-full rounded bg-gray-800 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300">
              Slett bilde
            </button>
          )}
        </div>
      </aside>
    </div>
  )
}

function ExifRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-sm text-gray-200 break-words">{value}</p>
    </div>
  )
}

function ExifChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded bg-gray-800 px-2 py-1 text-center">
      <p className="text-[9px] text-gray-600 uppercase">{label}</p>
      <p className="text-xs text-gray-300">{value}</p>
    </div>
  )
}
