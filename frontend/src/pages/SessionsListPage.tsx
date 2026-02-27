import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listSessions } from '../api/inputSessions'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SessionsListPage() {
  const navigate = useNavigate()
  const { data: sessions = [], isLoading, isError } = useQuery({
    queryKey: ['sessions'],
    queryFn: listSessions,
  })

  function openSession(session: { id: string; name: string }) {
    const params = new URLSearchParams({ session_id: session.id, title: session.name })
    navigate(`/browse?${params}`)
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <button onClick={() => navigate('/')} className="text-sm text-gray-400 hover:text-white transition-colors">
          ← Tilbake
        </button>
        <h1 className="text-xl font-semibold">Registreringssesjoner</h1>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {isLoading && <p className="text-gray-400 py-8 text-center">Laster…</p>}
        {isError && <p className="text-red-400 py-8 text-center">Kunne ikke hente sesjoner.</p>}
        {!isLoading && sessions.length === 0 && (
          <p className="text-gray-500 py-8 text-center">Ingen sesjoner registrert ennå.</p>
        )}
        <ul className="flex flex-col gap-2">
          {sessions.map(session => (
            <li key={session.id}>
              <button
                onClick={() => openSession(session)}
                className="w-full text-left rounded-xl bg-gray-800 px-4 py-3 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium truncate">{session.name}</span>
                  <span className="text-sm text-gray-400 shrink-0">
                    {session.photo_count} bilder
                  </span>
                </div>
                <div className="flex items-baseline gap-3 mt-0.5">
                  <span className="text-sm text-gray-500 truncate">{session.source_path}</span>
                  <span className="text-xs text-gray-600 shrink-0">{formatDate(session.started_at)}</span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
