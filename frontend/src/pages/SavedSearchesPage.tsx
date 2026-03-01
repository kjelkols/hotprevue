import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listSearches, deleteSearch } from '../api/searches'

export default function SavedSearchesPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: searches = [], isLoading } = useQuery({
    queryKey: ['searches'],
    queryFn: listSearches,
  })

  const deleteMutation = useMutation({
    mutationFn: deleteSearch,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['searches'] }),
  })

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold flex-1">Lagrede søk</h1>
        <button
          onClick={() => navigate('/searches/new')}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 transition-colors"
        >
          + Nytt søk
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {isLoading && <p className="text-gray-400 text-center py-8">Laster…</p>}
        {!isLoading && searches.length === 0 && (
          <p className="text-gray-500 text-center py-8">Ingen lagrede søk ennå.</p>
        )}
        <ul className="flex flex-col gap-2">
          {searches.map(s => (
            <li key={s.id} className="flex items-center gap-3 rounded-xl bg-gray-800 px-4 py-3">
              <button
                onClick={() => navigate(`/searches/${s.id}`)}
                className="flex-1 text-left font-medium hover:text-blue-300 transition-colors truncate"
              >
                {s.name}
              </button>
              {s.description && (
                <span className="text-sm text-gray-400 truncate max-w-xs hidden sm:block">
                  {s.description}
                </span>
              )}
              <span className="text-xs text-gray-500 shrink-0">
                {s.criteria.length} {s.criteria.length === 1 ? 'kriterie' : 'kriterier'}
              </span>
              <button
                onClick={() => deleteMutation.mutate(s.id)}
                disabled={deleteMutation.isPending}
                className="text-gray-500 hover:text-red-400 transition-colors text-sm shrink-0 disabled:opacity-50"
              >
                Slett
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
