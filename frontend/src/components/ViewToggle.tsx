import GridVariantDropdown from './GridVariantDropdown'

type View = 'grid' | 'timeline'

interface Props {
  view: View
  onChange: (v: View) => void
}

export default function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <GridVariantDropdown disabled={view === 'timeline'} />
      <button
        onClick={() => onChange(view === 'timeline' ? 'grid' : 'timeline')}
        className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
          view === 'timeline'
            ? 'bg-gray-600 text-white hover:bg-gray-500'
            : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
        }`}
      >
        Tidslinje
      </button>
    </div>
  )
}
