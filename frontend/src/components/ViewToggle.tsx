import GridVariantDropdown from './GridVariantDropdown'
import useViewStore, { type BrowseView } from '../stores/useViewStore'
import useSelectionStore from '../stores/useSelectionStore'

interface Props {
  view: BrowseView
  onChange: (v: BrowseView) => void
}

export default function ViewToggle({ view, onChange }: Props) {
  const stacksCollapsed = useViewStore(s => s.stacksCollapsed)
  const setStacksCollapsed = useViewStore(s => s.setStacksCollapsed)

  function handleStackToggle() {
    setStacksCollapsed(!stacksCollapsed)
    useSelectionStore.getState().clear()
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <GridVariantDropdown disabled={view !== 'grid'} />
      {view === 'grid' && (
        <button
          onClick={handleStackToggle}
          title={stacksCollapsed ? 'Vis alle bilder i stacker' : 'Kollaps stacker'}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            !stacksCollapsed
              ? 'bg-blue-600/20 border-blue-500 text-blue-300 hover:bg-blue-600/30'
              : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-white hover:bg-gray-700'
          }`}
        >
          Ekspander stack
        </button>
      )}
      <div className="flex rounded-lg overflow-hidden border border-gray-700">
        {(['grid', 'timeline'] as const).map(v => (
          <button
            key={v}
            onClick={() => onChange(v)}
            className={`px-3 py-1.5 text-sm transition-colors ${
              view === v
                ? 'bg-gray-600 text-white'
                : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-700'
            }`}
          >
            {v === 'grid' ? 'Grid' : 'Tre'}
          </button>
        ))}
      </div>
    </div>
  )
}
