import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listCollections, addCollectionItemsBatch } from '../../api/collections'
import useSelectionStore from '../../stores/useSelectionStore'
import useAssignmentStore from '../../stores/useAssignmentStore'

export default function CollectionPickerModal() {
  const [filter, setFilter] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const qc = useQueryClient()
  const selected = useSelectionStore(s => s.selected)
  const clear = useSelectionStore(s => s.clear)
  const modal = useAssignmentStore(s => s.modal)
  const close = useAssignmentStore(s => s.close)

  const open = modal === 'collection'

  const { data: collections = [] } = useQuery({
    queryKey: ['collections'],
    queryFn: listCollections,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: () => addCollectionItemsBatch(selectedId!, Array.from(selected)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['collections'] })
      clear()
      setFilter('')
      setSelectedId(null)
      close()
    },
  })

  if (!open) return null

  const filtered = collections.filter(c =>
    c.name.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={close}>
      <div className="w-80 rounded-xl border border-gray-700 bg-gray-900 shadow-xl" onClick={e => e.stopPropagation()}>
        <div className="p-4 border-b border-gray-800">
          <p className="text-sm font-medium text-gray-300 mb-3">
            Legg til {selected.size} {selected.size === 1 ? 'bilde' : 'bilder'} i samling
          </p>
          <input
            autoFocus
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Søk etter samling…"
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
        </div>
        <ul className="max-h-64 overflow-y-auto divide-y divide-gray-800">
          {filtered.length === 0 && (
            <li className="px-4 py-3 text-sm text-gray-500">Ingen samlinger funnet</li>
          )}
          {filtered.map(c => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => setSelectedId(c.id)}
                className={`w-full text-left px-4 py-2.5 text-sm transition-colors ${
                  selectedId === c.id
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-200 hover:bg-gray-800'
                }`}
              >
                <span className="block truncate">{c.name}</span>
                {c.description && (
                  <span className="block text-xs text-gray-500 truncate">{c.description}</span>
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
            {mutation.isPending ? 'Setter inn…' : 'Sett inn →'}
          </button>
        </div>
      </div>
    </div>
  )
}
