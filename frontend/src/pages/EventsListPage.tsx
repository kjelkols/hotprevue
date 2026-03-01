import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listEvents } from '../api/events'
import EventCreateDialog from '../features/events/EventCreateDialog'

export default function EventsListPage() {
  const navigate = useNavigate()
  const [createOpen, setCreateOpen] = useState(false)
  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ['events'],
    queryFn: listEvents,
  })

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold flex-1">Events</h1>
        <button
          onClick={() => setCreateOpen(true)}
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
        >
          + Nytt event
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {isLoading && <p className="text-gray-400 py-8 text-center">Laster…</p>}
        {isError && <p className="text-red-400 py-8 text-center">Kunne ikke hente events.</p>}
        {!isLoading && events.length === 0 && (
          <p className="text-gray-500 py-8 text-center">Ingen events opprettet ennå.</p>
        )}
        <ul className="flex flex-col gap-2">
          {events.map(event => (
            <li key={event.id}>
              <button
                onClick={() => navigate(`/events/${event.id}`)}
                className="w-full text-left rounded-xl bg-gray-800 px-4 py-3 hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-baseline justify-between gap-4">
                  <span className="font-medium truncate">{event.name}</span>
                  <span className="text-sm text-gray-400 shrink-0">{event.photo_count} bilder</span>
                </div>
                {(event.date || event.location) && (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {[event.date, event.location].filter(Boolean).join(' · ')}
                  </p>
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>

      <EventCreateDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  )
}
