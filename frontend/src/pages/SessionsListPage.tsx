import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSessions, deleteSession } from '../api/inputSessions'

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
}

export default function SessionsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { data: sessions = [], isLoading, isError } = useQuery({
    queryKey: ['sessions'],
    queryFn: listSessions,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSession,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })

  function openSession(session: { id: string; name: string }) {
    const params = new URLSearchParams({ session_id: session.id, title: session.name })
    navigate(`/browse?${params}`)
  }

  function handleDelete(e: React.MouseEvent, sessionId: string, name: string) {
    e.stopPropagation()
    if (!window.confirm(`Slett registreringen «${name}»?`)) return
    deleteMutation.mutate(sessionId)
  }

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold flex-1">Registreringssesjoner</h1>
        <button
          onClick={() => navigate('/register')}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white hover:bg-blue-500"
        >
          + Ny registrering
        </button>
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
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-sm text-gray-400">
                      {session.photo_count} bilder
                    </span>
                    {session.photo_count === 0 && (
                      <button
                        onClick={e => handleDelete(e, session.id, session.name)}
                        className="text-xs text-gray-500 hover:text-red-400 transition-colors"
                      >
                        Slett
                      </button>
                    )}
                  </div>
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
