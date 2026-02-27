import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listEvents } from '../api/events'
import type { EventNode } from '../types/api'
import EventTreeItem from '../features/events/EventTreeItem'

export default function EventsListPage() {
  const navigate = useNavigate()
  const { data: events = [], isLoading, isError } = useQuery({
    queryKey: ['events'],
    queryFn: listEvents,
  })

  function openEvent(event: EventNode) {
    const params = new URLSearchParams({ event_id: event.id, title: event.name })
    navigate(`/browse?${params}`)
  }

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Events</h1>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {isLoading && <p className="text-gray-400 py-8 text-center">Laster…</p>}
        {isError && <p className="text-red-400 py-8 text-center">Kunne ikke hente events.</p>}
        {!isLoading && events.length === 0 && (
          <p className="text-gray-500 py-8 text-center">Ingen events opprettet ennå.</p>
        )}
        <ul className="flex flex-col gap-2">
          {events.map(event => (
            <EventTreeItem key={event.id} event={event} onOpen={openEvent} />
          ))}
        </ul>
      </div>
    </div>
  )
}
