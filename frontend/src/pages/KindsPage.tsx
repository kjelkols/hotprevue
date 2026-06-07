import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { listKinds, deleteKind } from '../api/kinds'
import KindDialog from '../features/kinds/KindDialog'
import type { KindOut } from '../types/api'

function parseApiError(err: unknown): string {
  if (!(err instanceof Error)) return 'Ukjent feil'
  const m = err.message.match(/"detail"\s*:\s*"([^"]+)"/)
  return m ? m[1] : err.message
}

export default function KindsPage() {
  const queryClient = useQueryClient()
  const [dialogTarget, setDialogTarget] = useState<KindOut | null | false>(false)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})

  const { data: kinds = [], isLoading, isError } = useQuery({
    queryKey: ['kinds'],
    queryFn: listKinds,
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteKind(id),
    onSuccess: (_data, id) => {
      setDeleteErrors(prev => { const next = { ...prev }; delete next[id]; return next })
      queryClient.invalidateQueries({ queryKey: ['kinds'] })
    },
    onError: (err, id) => {
      setDeleteErrors(prev => ({ ...prev, [id]: parseApiError(err) }))
    },
  })

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold flex-1">Kinds</h1>
        <button
          onClick={() => setDialogTarget(null)}
          className="rounded-lg bg-gray-800 px-3 py-1.5 text-sm text-gray-200 hover:bg-gray-700 transition-colors"
        >
          + Nytt kind
        </button>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {isLoading && <p className="text-gray-400 py-8 text-center">Laster…</p>}
        {isError && <p className="text-red-400 py-8 text-center">Kunne ikke hente kinds.</p>}
        <ul className="flex flex-col gap-2">
          {kinds.map(k => (
            <li key={k.id} className="rounded-xl bg-gray-800 px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                {k.color && (
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: k.color }} />
                )}
                <span className="font-medium">{k.name}</span>
                {k.is_default && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900 text-blue-300">Standard</span>
                )}
                {k.hidden_by_default && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Skjult som standard</span>
                )}
              </div>
              {k.description && (
                <p className="text-xs text-gray-500 mt-0.5">{k.description}</p>
              )}
              {deleteErrors[k.id] && (
                <p className="text-xs text-red-400 mt-1">{deleteErrors[k.id]}</p>
              )}
              <div className="flex gap-2 mt-2">
                <button
                  onClick={() => { setDeleteErrors(prev => { const n = {...prev}; delete n[k.id]; return n }); setDialogTarget(k) }}
                  className="rounded px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Rediger
                </button>
                {!k.is_default && (
                  <button
                    onClick={() => deleteMutation.mutate(k.id)}
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

      <KindDialog
        open={dialogTarget !== false}
        onOpenChange={open => { if (!open) setDialogTarget(false) }}
        kind={dialogTarget || undefined}
      />
    </div>
  )
}
