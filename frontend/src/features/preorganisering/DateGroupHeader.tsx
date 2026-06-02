import type { PrescanFileEntry } from '../../types/api'
import usePreorganiserStore from '../../stores/usePreorganiserStore'

interface Props {
  date: string
  label: string
  files: PrescanFileEntry[]
  allFiles: PrescanFileEntry[]
  onMoveRequest: () => void
}

export default function DateGroupHeader({ date, label, files, allFiles, onMoveRequest }: Props) {
  const selected = usePreorganiserStore(s => s.selected)
  const dateAnchor = usePreorganiserStore(s => s.dateAnchor)
  const selectDate = usePreorganiserStore(s => s.selectDate)
  const toggleDate = usePreorganiserStore(s => s.toggleDate)
  const selectDateRange = usePreorganiserStore(s => s.selectDateRange)

  const paths = files.map(f => f.file_path)
  const allSelected = paths.length > 0 && paths.every(p => selected.has(p))
  const someSelected = !allSelected && paths.some(p => selected.has(p))

  function handleClick(e: React.MouseEvent) {
    e.preventDefault()
    if (e.shiftKey && dateAnchor) {
      selectDateRange(dateAnchor, date, allFiles)
    } else if (e.ctrlKey || e.metaKey) {
      toggleDate(date, paths)
    } else {
      selectDate(date, paths)
    }
  }

  return (
    <div
      className="flex w-full items-center gap-3 py-2 px-1 mt-4 first:mt-0 cursor-pointer select-none group"
      onClick={handleClick}
    >
      {/* Avkryssingsboks */}
      <div className={[
        'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors',
        allSelected
          ? 'border-blue-500 bg-blue-500'
          : someSelected
          ? 'border-blue-400 bg-blue-400/30'
          : 'border-gray-600 group-hover:border-gray-400',
      ].join(' ')}>
        {allSelected && (
          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
        {someSelected && <div className="w-2 h-0.5 bg-blue-300 rounded" />}
      </div>

      {/* Dato og antall */}
      <span className={[
        'text-sm font-semibold transition-colors',
        allSelected ? 'text-blue-300' : 'text-gray-300 group-hover:text-white',
      ].join(' ')}>
        {label}
      </span>
      <span className="text-xs text-gray-600">{files.length} bilde{files.length !== 1 ? 'r' : ''}</span>

      {/* Linje */}
      <div className="flex-1 h-px bg-gray-800" />

      {/* Flytt til ny mappe */}
      <button
        onClick={e => { e.stopPropagation(); onMoveRequest() }}
        className="shrink-0 hidden rounded px-2 py-0.5 text-xs text-gray-500 hover:bg-gray-800 hover:text-gray-200 group-hover:block"
        title="Flytt til ny mappe"
      >
        → mappe
      </button>
    </div>
  )
}
