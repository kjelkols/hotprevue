import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import PhotoGrid from '../features/browse/PhotoGrid'
import PhotoTimeline from '../features/browse/PhotoTimeline'
import ViewToggle from '../components/ViewToggle'
import { usePhotoSource } from '../hooks/usePhotoSource'

export default function BrowsePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id') ?? undefined
  const eventId = searchParams.get('event_id') ?? undefined
  const tag = searchParams.get('tag') ?? undefined
  const title = searchParams.get('title') ?? tag ?? 'Utvalg'

  const photoSource = usePhotoSource({ sessionId, eventId, tag })
  const [view, setView] = useState<'grid' | 'timeline'>('grid')

  const upUrl = eventId ? `/events/${eventId}` : sessionId ? '/sessions' : tag ? '/tags' : null

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        {upUrl && (
          <button
            onClick={() => navigate(upUrl)}
            className="text-sm text-gray-400 hover:text-white transition-colors shrink-0"
          >
            ← Tilbake
          </button>
        )}
        <h1 className="text-xl font-semibold flex-1 truncate">{title}</h1>
        <ViewToggle view={view} onChange={setView} />
      </div>

      <div className="p-4">
        {view === 'grid'
          ? <PhotoGrid {...photoSource} />
          : <PhotoTimeline key={`${sessionId}-${eventId}-${tag}`} sessionId={sessionId} eventId={eventId} tag={tag} />
        }
      </div>
    </div>
  )
}
