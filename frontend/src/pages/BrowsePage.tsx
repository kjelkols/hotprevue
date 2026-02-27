import { useNavigate, useSearchParams } from 'react-router-dom'
import PhotoGrid from '../features/browse/PhotoGrid'

export default function BrowsePage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionId = searchParams.get('session_id') ?? undefined
  const eventId = searchParams.get('event_id') ?? undefined
  const title = searchParams.get('title') ?? 'Utvalg'

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-gray-400 hover:text-white transition-colors"
        >
          ← Tilbake
        </button>
        <h1 className="text-xl font-semibold">{title}</h1>
      </div>

      <div className="p-4">
        <PhotoGrid sessionId={sessionId} eventId={eventId} />
      </div>
    </div>
  )
}
