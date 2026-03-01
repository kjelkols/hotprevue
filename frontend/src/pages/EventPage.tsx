import { useState } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEvent, patchEvent, deleteEvent } from '../api/events'
import useNavigationStore from '../stores/useNavigationStore'
import PhotoGrid from '../features/browse/PhotoGrid'

export default function EventPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')

  const addSource = useNavigationStore(s => s.addSource)
  const setTarget = useNavigationStore(s => s.setTarget)
  const isSource = useNavigationStore(s => s.sources.some(src => src.id === id))
  const isTarget = useNavigationStore(s => s.target?.id === id)

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEvent(id!),
    enabled: !!id,
  })

  const renameMutation = useMutation({
    mutationFn: () => patchEvent(id!, { name: editName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setEditing(false)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => deleteEvent(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      navigate('/events')
    },
  })

  function handleDelete() {
    if (!event) return
    if (window.confirm(`Slett eventet «${event.name}»?`)) {
      deleteMutation.mutate()
    }
  }

  function startEdit() {
    setEditName(event?.name ?? '')
    setEditing(true)
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim()) return
    renameMutation.mutate()
  }

  function handleAddSource() {
    if (!event) return
    addSource({ id: id!, type: 'event', label: event.name, url: location.pathname })
  }

  function handleSetTarget() {
    if (!event) return
    setTarget({ id: id!, type: 'event', label: event.name, url: location.pathname })
  }

  if (isLoading) return <div className="flex h-screen items-center justify-center bg-gray-950 text-gray-400">Laster…</div>
  if (isError || !event) return <div className="flex h-screen items-center justify-center bg-gray-950 text-red-400">Kunne ikke hente event.</div>

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-800">
        <button onClick={() => navigate('/events')} className="text-sm text-gray-400 hover:text-white transition-colors shrink-0">
          ← Tilbake
        </button>
        {editing ? (
          <form onSubmit={handleRename} className="flex-1 flex gap-2">
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none"
            />
            <button type="submit" disabled={renameMutation.isPending} className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
              Lagre
            </button>
            <button type="button" onClick={() => setEditing(false)} className="rounded-lg bg-gray-800 px-3 py-1 text-sm text-gray-300 hover:bg-gray-700">
              Avbryt
            </button>
          </form>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold truncate">{event.name}</h1>
              {(event.date || event.location) && (
                <p className="text-sm text-gray-400 truncate">
                  {[event.date, event.location].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <span className="text-sm text-gray-500 shrink-0">{event.photo_count} bilder</span>
            <button
              onClick={handleAddSource}
              disabled={isTarget}
              title={isTarget ? 'Kan ikke være kilde når den er satt som mål' : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors shrink-0 ${
                isSource
                  ? 'bg-gray-600 text-white hover:bg-gray-500'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40'
              }`}
            >
              {isSource ? 'Kilde ✓' : 'Sett som kilde'}
            </button>
            <button
              onClick={handleSetTarget}
              disabled={isSource}
              title={isSource ? 'Kan ikke være mål når den er satt som kilde' : undefined}
              className={`rounded-lg px-3 py-1.5 text-sm transition-colors shrink-0 ${
                isTarget
                  ? 'bg-amber-700 text-white hover:bg-amber-600'
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700 disabled:opacity-40'
              }`}
            >
              {isTarget ? 'Mål ✓' : 'Sett som mål'}
            </button>
            <button
              onClick={startEdit}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors shrink-0"
            >
              Rediger
            </button>
            <button
              onClick={handleDelete}
              className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-red-400 hover:bg-gray-700 transition-colors shrink-0"
            >
              Slett
            </button>
          </>
        )}
      </div>

      <div className="p-4">
        <PhotoGrid eventId={id} />
      </div>
    </div>
  )
}
