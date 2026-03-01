import { useNavigate, useSearchParams, useLocation } from 'react-router-dom'
import PhotoGrid from '../features/browse/PhotoGrid'
import useNavigationStore from '../stores/useNavigationStore'

export default function BrowsePage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id') ?? undefined
  const eventId = searchParams.get('event_id') ?? undefined
  const tag = searchParams.get('tag') ?? undefined
  const title = searchParams.get('title') ?? tag ?? 'Utvalg'

  const addSource = useNavigationStore(s => s.addSource)
  const setTarget = useNavigationStore(s => s.setTarget)
  const sources = useNavigationStore(s => s.sources)
  const navTarget = useNavigationStore(s => s.target)

  const sourceId = tag ?? sessionId ?? eventId
  const sourceType = tag ? 'tag' : sessionId ? 'session' : 'event'
  const isSource = sourceId ? sources.some(s => s.id === sourceId) : false
  const isTarget = sourceId ? navTarget?.id === sourceId : false

  function handleAddSource() {
    if (!sourceId) return
    addSource({
      id: sourceId,
      type: sourceType as 'session' | 'event' | 'tag',
      label: title,
      url: location.pathname + location.search,
    })
  }

  function handleSetTarget() {
    if (!sourceId || sourceType === 'session') return
    setTarget({
      id: sourceId,
      type: sourceType as 'event' | 'tag',
      label: title,
      url: location.pathname + location.search,
    })
  }

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-white transition-colors shrink-0"
        >
          ← Tilbake
        </button>
        <h1 className="text-xl font-semibold flex-1 truncate">{title}</h1>
        {sourceId && (
          <button
            onClick={handleAddSource}
            disabled={isTarget}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors shrink-0 ${
              isSource
                ? 'bg-gray-600 text-white hover:bg-gray-500'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40'
            }`}
          >
            {isSource ? 'Kilde ✓' : 'Sett som kilde'}
          </button>
        )}
        {sourceId && sourceType !== 'session' && (
          <button
            onClick={handleSetTarget}
            disabled={isSource}
            className={`rounded-lg px-3 py-1.5 text-sm transition-colors shrink-0 ${
              isTarget
                ? 'bg-amber-700 text-white hover:bg-amber-600'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40'
            }`}
          >
            {isTarget ? 'Mål ✓' : 'Sett som mål'}
          </button>
        )}
      </div>

      <div className="p-4">
        <PhotoGrid sessionId={sessionId} eventId={eventId} tag={tag} />
      </div>
    </div>
  )
}
