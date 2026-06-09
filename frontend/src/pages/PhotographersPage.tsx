import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { listPhotographers, deletePhotographer } from '../api/photographers'
import { createInviteCode, setPhotographerAccessLevel } from '../api/machineAuth'
import PhotographerDialog from '../features/photographers/PhotographerDialog'
import type { Photographer } from '../types/api'

function parseApiError(err: unknown): string {
  if (!(err instanceof Error)) return 'Ukjent feil'
  const m = err.message.match(/"detail"\s*:\s*"([^"]+)"/)
  return m ? m[1] : err.message
}

function AccessBadge({ level }: { level: string }) {
  if (level === 'owner')
    return <span className="text-xs px-1.5 py-0.5 rounded bg-yellow-900 text-yellow-300">Eier</span>
  return <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Gjest</span>
}

function InviteModal({ photographer, onClose }: { photographer: Photographer; onClose: () => void }) {
  const [ttl, setTtl] = useState(60)
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState('')

  function generate() {
    setError('')
    createInviteCode({ target_photographer_id: photographer.id, ttl_minutes: ttl })
      .then(c => setCode(c.code))
      .catch(e => setError(parseApiError(e)))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-gray-900 rounded-xl p-6 w-80 flex flex-col gap-4">
        <h2 className="font-semibold text-lg">Inviter ny maskin</h2>
        <p className="text-sm text-gray-400">
          Koden kobler ny maskin til <span className="text-white">{photographer.name}</span>.
        </p>
        {!code ? (
          <>
            <label className="text-sm text-gray-400">
              Gyldig i (min)
              <input
                type="number"
                min={5}
                max={10080}
                value={ttl}
                onChange={e => setTtl(Number(e.target.value))}
                className="mt-1 w-full rounded bg-gray-800 px-3 py-1.5 text-white text-sm"
              />
            </label>
            {error && <p className="text-xs text-red-400">{error}</p>}
            <div className="flex gap-2 justify-end">
              <button onClick={onClose} className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600">Avbryt</button>
              <button onClick={generate} className="px-3 py-1.5 rounded text-sm bg-blue-700 hover:bg-blue-600">Generer kode</button>
            </div>
          </>
        ) : (
          <>
            <div className="rounded bg-gray-800 px-4 py-3 text-center font-mono text-2xl tracking-widest text-white">
              {code}
            </div>
            <p className="text-xs text-gray-500 text-center">Gyldig i {ttl} minutter</p>
            <button onClick={onClose} className="px-3 py-1.5 rounded text-sm bg-gray-700 hover:bg-gray-600 self-end">Lukk</button>
          </>
        )}
      </div>
    </div>
  )
}

export default function PhotographersPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [dialogTarget, setDialogTarget] = useState<Photographer | null | false>(false)
  const [deleteErrors, setDeleteErrors] = useState<Record<string, string>>({})
  const [inviteTarget, setInviteTarget] = useState<Photographer | null>(null)

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

  const accessMutation = useMutation({
    mutationFn: ({ id, level }: { id: string; level: string }) =>
      setPhotographerAccessLevel(id, level),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['photographers'] }),
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
                <AccessBadge level={p.access_level} />
                {p.is_default && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-blue-900 text-blue-300">Standard</span>
                )}
                {p.is_unknown && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Ukjent</span>
                )}
                <button
                  onClick={() => navigate(`/maskiner?photographer_id=${p.id}`)}
                  className="ml-auto text-xs text-gray-400 hover:text-white transition-colors"
                >
                  {p.machine_count} {p.machine_count === 1 ? 'maskin' : 'maskiner'}
                </button>
              </div>
              {p.last_seen_at && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Sist sett: {new Date(p.last_seen_at).toLocaleString('nb-NO')}
                </p>
              )}
              {p.website && <p className="text-xs text-gray-500 mt-0.5 truncate">{p.website}</p>}
              {deleteErrors[p.id] && (
                <p className="text-xs text-red-400 mt-1">{deleteErrors[p.id]}</p>
              )}
              <div className="flex gap-2 mt-2 flex-wrap">
                <button
                  onClick={() => { setDeleteErrors(prev => { const n = {...prev}; delete n[p.id]; return n }); setDialogTarget(p) }}
                  className="rounded px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 transition-colors"
                >
                  Rediger
                </button>
                {!p.is_unknown && (
                  <>
                    <button
                      onClick={() => setInviteTarget(p)}
                      className="rounded px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 transition-colors"
                    >
                      Inviter maskin
                    </button>
                    <button
                      onClick={() => accessMutation.mutate({ id: p.id, level: p.access_level === 'owner' ? 'guest' : 'owner' })}
                      disabled={accessMutation.isPending}
                      className="rounded px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 transition-colors disabled:opacity-50"
                    >
                      {p.access_level === 'owner' ? 'Gjør til gjest' : 'Gjør til eier'}
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(p.id)}
                      disabled={deleteMutation.isPending}
                      className="rounded px-3 py-1 text-xs bg-gray-700 hover:bg-red-800 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                    >
                      Slett
                    </button>
                  </>
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

      {inviteTarget && (
        <InviteModal photographer={inviteTarget} onClose={() => setInviteTarget(null)} />
      )}
    </div>
  )
}
