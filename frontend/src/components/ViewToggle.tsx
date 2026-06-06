import GridVariantDropdown from './GridVariantDropdown'

export type View = 'grid' | 'timeline' | 'zoom-timeline'

interface Props {
  view: View
  onChange: (v: View) => void
}

const VIEWS: { id: View; label: string }[] = [
  { id: 'grid', label: 'Grid' },
  { id: 'timeline', label: 'Tre' },
  { id: 'zoom-timeline', label: 'Zoom' },
]

export default function ViewToggle({ view, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 shrink-0">
      <GridVariantDropdown disabled={view !== 'grid'} />
      <div className="flex rounded-lg overflow-hidden border border-gray-700">
        {VIEWS.map(v => (
          <button
            key={v.id}
            onClick={() => onChange(v.id)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              view === v.id
                ? 'bg-gray-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>
    </div>
  )
}
