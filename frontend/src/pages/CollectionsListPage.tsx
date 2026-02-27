import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listCollections, createCollection } from '../api/collections'

export default function CollectionsListPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  const { data: collections = [], isLoading } = useQuery({
    queryKey: ['collections'],
    queryFn: listCollections,
  })

  const createMutation = useMutation({
    mutationFn: createCollection,
    onSuccess: (collection) => {
      queryClient.invalidateQueries({ queryKey: ['collections'] })
      setCreating(false)
      setName('')
      setDescription('')
      navigate(`/collections/${collection.id}`)
    },
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    createMutation.mutate({ name: name.trim(), description: description.trim() || null })
  }

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold flex-1">Kolleksjoner</h1>
        <button
          onClick={() => setCreating(v => !v)}
          className="rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium hover:bg-blue-500 transition-colors"
        >
          + Ny kollektion
        </button>
      </div>

      {creating && (
        <form onSubmit={handleSubmit} className="flex gap-3 px-4 py-3 border-b border-gray-800 bg-gray-900">
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Navn"
            autoFocus
            className="flex-1 rounded-lg bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <input
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="Beskrivelse (valgfritt)"
            className="flex-[2] rounded-lg bg-gray-800 px-3 py-2 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button type="submit" disabled={!name.trim()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-40 transition-colors">
            Opprett
          </button>
          <button type="button" onClick={() => setCreating(false)} className="rounded-lg bg-gray-700 px-4 py-2 text-sm hover:bg-gray-600 transition-colors">
            Avbryt
          </button>
        </form>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">Laster…</div>
      ) : collections.length === 0 ? (
        <p className="px-4 py-16 text-center text-gray-500">Ingen kolleksjoner ennå.</p>
      ) : (
        <div className="divide-y divide-gray-800">
          {collections.map(c => (
            <button
              key={c.id}
              onClick={() => navigate(`/collections/${c.id}`)}
              className="w-full text-left px-4 py-4 hover:bg-gray-900 flex items-center gap-4 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <p className="font-medium text-white truncate">{c.name}</p>
                {c.description && <p className="mt-0.5 text-sm text-gray-400 truncate">{c.description}</p>}
              </div>
              <span className="text-sm text-gray-500 shrink-0">
                {c.item_count} element{c.item_count !== 1 ? 'er' : ''}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
