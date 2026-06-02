import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AGENT_URL } from '../../api/agentClient'
import { getExif } from '../../api/prescan'
import { deleteGroup } from '../../api/fileops'
import type { PrescanFileEntry } from '../../types/api'

interface Props {
  files: PrescanFileEntry[]
  index: number
  onNavigate: (i: number) => void
  onClose: () => void
  onDeleted: (path: string) => void
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

export default function PreviewLightbox({ files, index, onNavigate, onClose, onDeleted }: Props) {
  const file = files[index]
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const src = `${AGENT_URL}/process/preview?path=${encodeURIComponent(file.file_path)}&maxpx=1600`

  const { data: exif } = useQuery({
    queryKey: ['exif', file.file_path],
    queryFn: () => getExif(file.file_path),
    staleTime: 60_000,
  })

  useEffect(() => {
    setConfirmDelete(false)
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { if (confirmDelete) setConfirmDelete(false); else onClose() }
      if (e.key === 'ArrowLeft' && index > 0) onNavigate(index - 1)
      if (e.key === 'ArrowRight' && index < files.length - 1) onNavigate(index + 1)
      if (e.key === 'Delete') setConfirmDelete(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [index, files.length, confirmDelete])

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

  const filename = file.file_path.split(/[\\/]/).pop() ?? ''
  const hasPrev = index > 0
  const hasNext = index < files.length - 1

  return (
    <div className="fixed inset-0 z-50 flex bg-black/95">

      {/* Bildeområde */}
      <div className="relative flex flex-1 items-center justify-center" onClick={onClose}>

        {/* Forrige */}
        <button
          onClick={e => { e.stopPropagation(); onNavigate(index - 1) }}
          disabled={!hasPrev}
          className="absolute left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white text-xl hover:bg-black/80 disabled:opacity-20 transition-opacity"
        >
          ‹
        </button>

        <img
          key={file.file_path}
          src={src}
          alt={filename}
          className="max-h-full max-w-full object-contain cursor-default"
          onClick={e => e.stopPropagation()}
          draggable={false}
        />

        {/* Neste */}
        <button
          onClick={e => { e.stopPropagation(); onNavigate(index + 1) }}
          disabled={!hasNext}
          className="absolute right-3 z-10 flex h-10 w-10 items-center justify-center rounded-full bg-black/50 text-white text-xl hover:bg-black/80 disabled:opacity-20 transition-opacity"
        >
          ›
        </button>

        {/* Teller */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-3 py-1 text-xs text-gray-300">
          {index + 1} / {files.length}
        </div>

        {/* Lukk */}
        <button
          onClick={onClose}
          className="absolute top-3 left-3 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white hover:bg-black/80 text-lg"
        >
          ×
        </button>
      </div>

      {/* Sidefelt */}
      <aside className="flex w-64 shrink-0 flex-col border-l border-gray-800 bg-gray-950 overflow-y-auto">
        <div className="p-4 space-y-4">

          {/* Filnavn */}
          <div>
            <p className="truncate text-sm font-medium text-white" title={filename}>{filename}</p>
            {file.companions.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">+{file.companions.length} companion{file.companions.length > 1 ? 's' : ''}</p>
            )}
          </div>

          {/* Dato */}
          <ExifRow label="Tatt" value={formatDate(exif?.taken_at ?? file.taken_at)} />

          {/* Kamera */}
          {(exif?.camera_make || exif?.camera_model) && (
            <ExifRow
              label="Kamera"
              value={[exif.camera_make, exif.camera_model].filter(Boolean).join(' ')}
            />
          )}

          {/* Linse */}
          {exif?.lens_model && <ExifRow label="Linse" value={exif.lens_model} />}

          {/* Eksponering */}
          {(exif?.iso || exif?.shutter_speed || exif?.aperture) && (
            <div>
              <p className="text-xs text-gray-500 mb-1">Eksponering</p>
              <div className="grid grid-cols-3 gap-1">
                {exif?.iso && <ExifChip label="ISO" value={String(exif.iso)} />}
                {exif?.shutter_speed && <ExifChip label="Lukker" value={exif.shutter_speed} />}
                {exif?.aperture && <ExifChip label="Blende" value={`f/${exif.aperture}`} />}
              </div>
              {exif?.focal_length && (
                <p className="mt-1 text-xs text-gray-400">{exif.focal_length} mm</p>
              )}
            </div>
          )}

          {/* Dimensjoner */}
          {(exif?.width && exif?.height) && (
            <ExifRow label="Størrelse" value={`${exif.width} × ${exif.height}`} />
          )}

          {/* Filstørrelse */}
          {exif?.file_size && <ExifRow label="Fil" value={formatBytes(exif.file_size)} />}

          {/* GPS */}
          {exif?.gps_lat != null && (
            <ExifRow
              label="GPS"
              value={`${exif.gps_lat.toFixed(5)}, ${exif.gps_lng?.toFixed(5)}`}
            />
          )}
        </div>

        {/* Slett */}
        <div className="mt-auto border-t border-gray-800 p-4">
          {confirmDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-red-400">
                Slett {1 + file.companions.length} fil{file.companions.length > 0 ? 'er' : ''}?
                Dette kan ikke angres.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfirmDelete(false)}
                  className="flex-1 rounded bg-gray-700 py-1.5 text-sm text-white hover:bg-gray-600"
                >
                  Avbryt
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="flex-1 rounded bg-red-700 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-50"
                >
                  {deleting ? 'Sletter…' : 'Slett'}
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setConfirmDelete(true)}
              className="w-full rounded bg-gray-800 py-2 text-sm text-red-400 hover:bg-gray-700 hover:text-red-300"
            >
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
