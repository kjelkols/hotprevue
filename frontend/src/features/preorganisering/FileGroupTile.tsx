import type { PrescanFileEntry } from '../../types/api'
import usePreorganiserStore from '../../stores/usePreorganiserStore'
import useContextMenuStore from '../../stores/useContextMenuStore'

interface Props {
  file: PrescanFileEntry
  orderedPaths: string[]
  onSelectSameDate: () => void
  onDoubleClick: () => void
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('nb-NO', { dateStyle: 'short', timeStyle: 'short' })
}

export default function FileGroupTile({ file, orderedPaths, onSelectSameDate, onDoubleClick }: Props) {
  const selected = usePreorganiserStore(s => s.selected)
  const selectOnly = usePreorganiserStore(s => s.selectOnly)
  const toggleOne = usePreorganiserStore(s => s.toggleOne)
  const selectRange = usePreorganiserStore(s => s.selectRange)
  const openContextMenu = useContextMenuStore(s => s.openContextMenu)

  const isSelected = selected.has(file.file_path)
  const selectedCount = selected.size
  const filename = file.file_path.split(/[\\/]/).pop() ?? file.file_path
  const hasPreview = !!file.hotpreview_b64

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (e.shiftKey) selectRange(file.file_path, orderedPaths)
    else if (e.ctrlKey || e.metaKey) toggleOne(file.file_path)
    else selectOnly(file.file_path)
  }

  function handleContextMenu(e: React.MouseEvent) {
    e.preventDefault()
    if (!isSelected) selectOnly(file.file_path)

    const sameDate = file.taken_at
      ? { id: 'same-date', label: `Velg med samme dato  (${file.taken_at.slice(0, 10)})`, action: onSelectSameDate }
      : null

    if (isSelected && selectedCount > 1) {
      openContextMenu({
        position: { x: e.clientX, y: e.clientY },
        items: [
          ...(sameDate ? [sameDate, { type: 'separator' as const }] : []),
          { id: 'move', label: `Flytt ${selectedCount} bilder til…`, action: () => {} },
        ],
      })
    } else {
      openContextMenu({
        position: { x: e.clientX, y: e.clientY },
        items: [
          ...(sameDate ? [sameDate, { type: 'separator' as const }] : []),
          { id: 'move', label: 'Flytt til…', action: () => {} },
        ],
      })
    }
  }

  return (
    <div className="group relative">
      <div
        className={[
          'relative w-[150px] h-[150px] cursor-pointer overflow-hidden rounded-sm',
          'ring-inset transition-all select-none',
          isSelected ? 'ring-2 ring-blue-400' : 'hover:ring-2 hover:ring-blue-400/60',
        ].join(' ')}
        onClick={handleClick}
        onDoubleClick={onDoubleClick}
        onContextMenu={handleContextMenu}
      >
        {hasPreview ? (
          <img
            src={`data:image/jpeg;base64,${file.hotpreview_b64}`}
            alt={filename}
            draggable={false}
            className="w-full h-full object-cover transition-transform duration-150 group-hover:scale-105"
          />
        ) : (
          <div className="w-full h-full bg-gray-800 flex items-center justify-center">
            <span className="text-xs text-gray-600 uppercase tracking-wide">{file.master_type}</span>
          </div>
        )}

        {isSelected && (
          <div className="absolute top-1 right-1 w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center pointer-events-none">
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
        )}

        {file.companions.length > 0 && (
          <div className="absolute bottom-1 left-1 bg-black/60 rounded px-1 py-0.5 text-[9px] text-gray-300 pointer-events-none">
            +{file.companions.length}
          </div>
        )}
      </div>

      {/* EXIF-tooltip */}
      <div className="pointer-events-none absolute left-0 top-full z-50 mt-1 hidden w-52 rounded-lg border border-gray-700 bg-gray-900 p-3 shadow-xl group-hover:block">
        <p className="mb-1 truncate text-xs font-medium text-white">{filename}</p>
        <div className="space-y-0.5 text-xs text-gray-400">
          <p>{formatDate(file.taken_at)}</p>
          {(file.camera_make || file.camera_model) && (
            <p className="truncate">{[file.camera_make, file.camera_model].filter(Boolean).join(' ')}</p>
          )}
          {file.gps_lat != null && (
            <p>{file.gps_lat.toFixed(5)}, {file.gps_lng?.toFixed(5)}</p>
          )}
          <p className="uppercase text-gray-600">{file.master_type}{file.companions.length > 0 ? ` +${file.companions.length}` : ''}</p>
        </div>
      </div>
    </div>
  )
}
