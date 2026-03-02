import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listPhotographers, deletePhotographer } from '../api/photographers'
import PhotographerDialog from '../features/photographers/PhotographerDialog'
import type { Photographer } from '../types/api'

function parseApiError(err: unknown): string {
  if (!(err instanceof Error)) return 'Ukjent feil'
  const m = err.message.match(/"detail"\s*:\s*"([^"]+)"/)
  return m ? m[1] : err.message
}

export default function PhotographersPage() {
  const queryClient = useQueryClient()
  const [dialogTarget, setDialogTarget] = useState<Photographer | null | false>(false)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  const { data: photographers = [], isLoading, isError } = useQuery({
    queryKey: ['photographers'],
    queryFn: listPhotographers,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePhotographer(id),
    onSuccess: (_data, id) => {
      setDeleteErrors(prev => { const next = { ...prev }; delete next[id]; return next })
      queryClient.invalidateQueries({ queryKey: ['photographers'] })
    },
    onError: (err, id) => {
      setDeleteErrors(prev => ({ ...prev, [id]: parseApiError(err) }))
    },
  })

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold flex-1">Fotografer</h1>
        <button
          onClick={() => setDialogTarget(null)}
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
        >
          + Ny fotograf
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {isLoading && <p className="text-gray-400 py-8 text-center">Laster…</p>}
        {isError && <p className="text-red-400 py-8 text-center">Kunne ikke hente fotografer.</p>}
        {!isLoading && photographers.length === 0 && (
          <p className="text-gray-500 py-8 text-center">Ingen fotografer registrert ennå.</p>
        )}
        <ul className="flex flex-col gap-2">
          {photographers.map(p => (
            <li key={p.id} className="rounded-xl bg-gray-800 px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{p.name}</span>
                {p.is_default && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900 text-blue-300">Standard</span>
                )}
                {p.is_unknown && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Ukjent</span>
                )}
              </div>
              {p.website && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.website}</p>}
              {p.bio && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.bio}</p>}
              {deleteErrors[p.id] && (
                <p className="text-xs text-red-400 mt-1">{deleteErrors[p.id]}</p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setDeleteErrors(prev => { const n = {...prev}; delete n[p.id]; return n }); setDialogTarget(p) }}
                  className="rounded px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Rediger
                </button>
                {!p.is_unknown && (
                  <button
                    onClick={() => deleteMutation.mutate(p.id)}
                    disabled={deleteMutation.isPending}
                    className="rounded px-3 py-1 text-xs bg-gray-700 hover:bg-red-800 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                  >
                    Slett
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>

      <PhotographerDialog
        open={dialogTarget !== false}
        onOpenChange={open => { if (!open) setDialogTarget(false) }}
        photographer={dialogTarget || undefined}
      />
    </div>
  )
}
