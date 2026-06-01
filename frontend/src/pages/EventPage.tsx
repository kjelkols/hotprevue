import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getEvent, patchEvent, deleteEvent, autoDateEvent } from '../api/events'
import PhotoGrid from '../features/browse/PhotoGrid'
import PhotoTimeline from '../features/browse/PhotoTimeline'
import ViewToggle from '../components/ViewToggle'
import { usePhotoSource } from '../hooks/usePhotoSource'
import { formatEventDate } from '../lib/formatDate'

export default function EventPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState('')
  const [editStartDate, setEditStartDate] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editLocation, setEditLocation] = useState('')
  const [view, setView] = useState<'grid' | 'timeline'>('grid')
  const [autoDateMsg, setAutoDateMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const photoSource = usePhotoSource({ eventId: id })

  const { data: event, isLoading, isError } = useQuery({
    queryKey: ['event', id],
    queryFn: () => getEvent(id!),
    enabled: !!id,
  })

  const renameMutation = useMutation({
    mutationFn: () => patchEvent(id!, {
      name: editName,
      start_date: editStartDate || null,
      end_date: editEndDate || null,
      location: editLocation || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setEditing(false)
    },
  })

  const autoDateMutation = useMutation({
    mutationFn: () => autoDateEvent(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['event', id] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setAutoDateMsg({ ok: true, text: 'Datoer oppdatert' })
    },
    onError: (err: Error) => {
      const text = err.message.includes('422') ? 'Ingen EXIF-datoer' : 'Noe gikk galt'
      setAutoDateMsg({ ok: false, text })
    },
  })

  useEffect(() => {
    if (!autoDateMsg) return
    const t = setTimeout(() => setAutoDateMsg(null), 3000)
    return () => clearTimeout(t)
  }, [autoDateMsg])

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
    setEditStartDate(event?.start_date ?? '')
    setEditEndDate(event?.end_date ?? '')
    setEditLocation(event?.location ?? '')
    setEditing(true)
  }

  function handleRename(e: React.FormEvent) {
    e.preventDefault()
    if (!editName.trim()) return
    renameMutation.mutate()
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
          <form onSubmit={handleRename} className="flex-1 flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                autoFocus
                value={editName}
                onChange={e => setEditName(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none"
                placeholder="Navn"
              />
              <button type="submit" disabled={renameMutation.isPending} className="rounded-lg bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500 disabled:opacity-50 shrink-0">
                Lagre
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg bg-gray-800 px-3 py-1 text-sm text-gray-300 hover:bg-gray-700 shrink-0">
                Avbryt
              </button>
            </div>
            <div className="flex gap-2">
              <input
                type="date"
                value={editStartDate}
                onChange={e => setEditStartDate(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none"
              />
              <input
                type="date"
                value={editEndDate}
                min={editStartDate || undefined}
                onChange={e => setEditEndDate(e.target.value)}
                className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none"
              />
              <input
                value={editLocation}
                onChange={e => setEditLocation(e.target.value)}
                placeholder="Sted"
                className="flex-1 bg-gray-800 border border-gray-600 rounded-lg px-3 py-1 text-white text-sm focus:outline-none"
              />
            </div>
          </form>
        ) : (
          <>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold truncate">{event.name}</h1>
              {(event.start_date || event.location) && (
                <p className="text-sm text-gray-400 truncate">
                  {[formatEventDate(event.start_date, event.end_date), event.location].filter(Boolean).join(' · ')}
                </p>
              )}
            </div>
            <span className="text-sm text-gray-500 shrink-0">{event.photo_count} bilder</span>
            <ViewToggle view={view} onChange={setView} />
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => autoDateMutation.mutate()}
                disabled={autoDateMutation.isPending}
                className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-400 hover:bg-gray-700 hover:text-gray-200 disabled:opacity-40 transition-colors"
                title="Sett start- og sluttdato fra bildenes EXIF-dato"
              >
                {autoDateMutation.isPending ? '…' : '⊙ Datoer fra bilder'}
              </button>
              {autoDateMsg && (
                <span className={`text-xs ${autoDateMsg.ok ? 'text-green-400' : 'text-amber-400'}`}>
                  {autoDateMsg.text}
                </span>
              )}
            </div>
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
        {view === 'grid'
          ? <PhotoGrid {...photoSource} />
          : <PhotoTimeline key={id} eventId={id} />
        }
      </div>
    </div>
  )
}
