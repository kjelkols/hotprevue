interface Props {
  selectedCount: number
  onMove: () => void
  onDelete: () => void
  onClear: () => void
}

export default function CollectionActionBar({ selectedCount, onMove, onDelete, onClear }: Props) {
  if (selectedCount === 0) return null

  return (
    <div className="bg-gray-900 border-b border-gray-700 px-4 py-2 flex items-center gap-3">
      <span className="text-sm text-gray-200 font-medium min-w-[6rem]">
        {selectedCount} valgt
      </span>
      <button
        onClick={onMove}
        className="px-3 py-1 text-sm bg-gray-700 hover:bg-gray-600 text-white rounded transition-colors"
      >
        Flytt hit
      </button>
      <button
        onClick={onDelete}
        className="px-3 py-1 text-sm bg-red-700 hover:bg-red-600 text-white rounded transition-colors"
      >
        Fjern fra kolleksjon
      </button>
      <span className="text-[11px] text-gray-500 ml-1">
        Klikk for å velge · Dra for å flytte enkeltbilde
      </span>
      <button
        onClick={onClear}
        className="ml-auto text-gray-400 hover:text-white transition-colors text-lg leading-none"
        aria-label="Fjern valg"
      >
        ✕
      </button>
    </div>
  )
}
