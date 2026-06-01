import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listEvents } from '../../api/events'
import { type EventSlot, deriveFolderName } from './registrationTypes'

interface Props {
  slots: EventSlot[]
  onChange: (slots: EventSlot[]) => void
}

export default function EventSection({ slots, onChange }: Props) {
  const slot = slots[0]
  const [mode, setMode] = useState<'new' | 'existing'>('new')

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: listEvents,
  })

  function updateSlot(patch: Partial<EventSlot>) {
    onChange([{ ...slot, ...patch }, ...slots.slice(1)])
  }

  function handleNameChange(name: string) {
    updateSlot({ eventName: name, folderName: deriveFolderName(name), eventId: null })
  }

  function handleExistingSelect(eventId: string) {
    const event = events.find(e => e.id === eventId)
    if (!event) { updateSlot({ eventId: null, eventName: '', folderName: '' }); return }
    updateSlot({ eventId, eventName: event.name, folderName: deriveFolderName(event.name) })
  }

  function switchMode(next: 'new' | 'existing') {
    setMode(next)
    updateSlot({ eventId: null, eventName: '', folderName: '' })
  }

  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-gray-300">Event</label>

      <div className="flex gap-2 mb-3">
        <button
          type="button"
          onClick={() => switchMode('new')}
          className={`text-sm px-3 py-1 rounded-lg transition-colors ${
            mode === 'new' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Opprett nytt
        </button>
        <button
          type="button"
          onClick={() => switchMode('existing')}
          className={`text-sm px-3 py-1 rounded-lg transition-colors ${
            mode === 'existing' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          Velg eksisterende
        </button>
      </div>

      {mode === 'new' ? (
        <input
          type="text"
          value={slot.eventName}
          onChange={e => handleNameChange(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
          placeholder="Navn på event (valgfritt)"
        />
      ) : (
        <select
          value={slot.eventId ?? ''}
          onChange={e => handleExistingSelect(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
        >
          <option value="">— Velg event —</option>
          {events.map(e => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </select>
      )}

      {slot.folderName && (
        <p className="mt-1.5 text-xs text-gray-500">
          Katalognavn: <span className="font-mono text-gray-400">{slot.folderName}</span>
        </p>
      )}
    </div>
  )
}
