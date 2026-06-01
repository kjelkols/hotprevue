import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listEvents } from '../../api/events'
import { assignEvent } from '../../api/photos'
import useSelectionStore from '../../stores/useSelectionStore'
import useAssignmentStore from '../../stores/useAssignmentStore'
import { formatEventDate } from '../../lib/formatDate'

export default function EventPickerModal() {
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const qc = useQueryClient()
  const selected = useSelectionStore(s => s.selected)
  const clear = useSelectionStore(s => s.clear)
  const modal = useAssignmentStore(s => s.modal)
  const close = useAssignmentStore(s => s.close)

  const open = modal === 'event'

  const { data: events = [] } = useQuery({
    queryKey: ['events'],
    queryFn: listEvents,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: () => assignEvent(Array.from(selected), selectedId!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['photos'] })
      qc.invalidateQueries({ queryKey: ['events'] })
      clear()
      setFilter('')
      setSelectedId(null)
      close()
    },
  })

  if (!open) return null

  const filtered = events.filter(e =>
    e.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={close}>
      <div className="w-80 rounded-xl border border-gray-700 bg-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-800">
          <p className="text-sm font-medium text-gray-300 mb-3">
            Registrer {selected.size} {selected.size === 1 ? 'bilde' : 'bilder'} på event
          </p>
          <input
            autoFocus
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Søk etter event…"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto divide-y divide-gray-800">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">Ingen events funnet</li>
          )}
          {filtered.map(e => (
            <li key={e.id}>
              <button
                type="button"
                onClick={() => setSelectedId(e.id)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  selectedId === e.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span>{e.name}</span>
                {e.start_date && (
                  <span className={`ml-2 text-xs ${selectedId === e.id ? 'text-blue-200' : 'text-gray-500'}`}>
                    {formatEventDate(e.start_date, e.end_date)}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
        <div className="flex justify-end gap-2 p-3 border-t border-gray-800">
          <button type="button" onClick={close} className="rounded-lg px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">
            Avbryt
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={!selectedId || mutation.isPending}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-40 transition-colors"
          >
            {mutation.isPending ? 'Registrerer…' : 'Registrer →'}
          </button>
        </div>
      </div>
    </div>
  )
}
