import PhotoGrid from '../features/browse/PhotoGrid'
import PhotoTimeline from '../features/browse/PhotoTimeline'
import ZoomTimeline from '../features/timeline/ZoomTimeline'
import GridVariantDropdown from '../components/GridVariantDropdown'
import useViewStore, { TIMELINE_VIEWS } from '../stores/useViewStore'
import useSelectionStore from '../stores/useSelectionStore'
import { usePhotoSource } from '../hooks/usePhotoSource'

export default function TimelinePage() {
  const timelineView = useViewStore(s => s.timelineView)
  const setTimelineView = useViewStore(s => s.setTimelineView)
  const stacksCollapsed = useViewStore(s => s.stacksCollapsed)
  const setStacksCollapsed = useViewStore(s => s.setStacksCollapsed)
  const photoSource = usePhotoSource({})

  function handleStackToggle() {
    setStacksCollapsed(!stacksCollapsed)
    useSelectionStore.getState().clear()
  }

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <div className="flex-1" />
        {timelineView === 'grid' && (
          <>
            <GridVariantDropdown disabled={false} />
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
          </>
        )}
        <div className="flex rounded-lg overflow-hidden border border-gray-700">
          {TIMELINE_VIEWS.map(v => (
            <button
              key={v.value}
              onClick={() => setTimelineView(v.value)}
              className={`px-3 py-1.5 text-sm transition-colors ${
                timelineView === v.value
                  ? 'bg-gray-600 text-white'
                  : 'bg-gray-900 text-gray-400 hover:text-white hover:bg-gray-700'
              }`}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>

      {timelineView === 'grid' && (
        <div className="p-4">
          <PhotoGrid {...photoSource} />
        </div>
      )}
      {timelineView === 'tree' && (
        <div className="p-4">
          <PhotoTimeline />
        </div>
      )}
      {timelineView === 'zoom' && (
        <div className="bg-gray-950 px-4 pb-4">
          <ZoomTimeline />
        </div>
      )}
    </div>
  )
}
