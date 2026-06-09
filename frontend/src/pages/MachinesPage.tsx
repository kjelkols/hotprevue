import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { listMachinesAdmin, revokeMachineToken, renameMachine } from '../api/machineAuth'

function RenameForm({ machineId, current, onDone }: { machineId: string; current: string; onDone: () => void }) {
  const queryClient = useQueryClient()
  const [name, setName] = useState(current)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: () => renameMachine(machineId, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['machines-admin'] })
      onDone()
    },
    onError: (e: unknown) => {
      const m = e instanceof Error ? e.message.match(/"detail"\s*:\s*"([^"]+)"/) : null
      setError(m ? m[1] : 'Feil ved lagring')
    },
  })

  return (
    <div className="flex gap-2 mt-2 items-center">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        className="rounded bg-gray-700 px-2 py-1 text-sm text-white flex-1 min-w-0"
        autoFocus
      />
      {error && <span className="text-xs text-red-400">{error}</span>}
      <button
        onClick={() => mutation.mutate()}
        disabled={mutation.isPending || !name.trim()}
        className="rounded px-3 py-1 text-xs bg-blue-700 hover:bg-blue-600 disabled:opacity-50"
      >
        Lagre
      </button>
      <button onClick={onDone} className="rounded px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600">
        Avbryt
      </button>
    </div>
  )
}

export default function MachinesPage() {
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const filterPhotographerId = searchParams.get('photographer_id')
  const [renamingId, setRenamingId] = useState<string | null>(null)

  const { data: machines = [], isLoading, isError } = useQuery({
    queryKey: ['machines-admin'],
    queryFn: listMachinesAdmin,
  })

  const revokeMutation = useMutation({
    mutationFn: (machineId: string) => revokeMachineToken(machineId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['machines-admin'] }),
  })

  const visible = filterPhotographerId
    ? machines.filter(m => m.photographer_id === filterPhotographerId)
    : machines

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-white text-sm">←</button>
        <h1 className="text-xl font-semibold flex-1">Maskiner</h1>
        {filterPhotographerId && (
          <button
            onClick={() => navigate('/maskiner')}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Vis alle
          </button>
        )}
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {isLoading && <p className="text-gray-400 py-8 text-center">Laster…</p>}
        {isError && <p className="text-red-400 py-8 text-center">Kunne ikke hente maskiner.</p>}
        {!isLoading && visible.length === 0 && (
          <p className="text-gray-500 py-8 text-center">Ingen maskiner funnet.</p>
        )}
        <ul className="flex flex-col gap-2">
          {visible.map(m => (
            <li key={m.machine_id} className="rounded-xl bg-gray-800 px-4 py-3">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium">{m.machine_name}</span>
                {m.has_active_token ? (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-green-900 text-green-300">Aktiv</span>
                ) : (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-gray-700 text-gray-400">Ingen token</span>
                )}
              </div>
              {m.photographer_name && (
                <p className="text-xs text-gray-400 mt-0.5">
                  Fotograf:{' '}
                  <button
                    onClick={() => navigate(`/fotografer`)}
                    className="hover:text-white transition-colors"
                  >
                    {m.photographer_name}
                  </button>
                </p>
              )}
              {m.last_seen_at && (
                <p className="text-xs text-gray-500 mt-0.5">
                  Sist sett: {new Date(m.last_seen_at).toLocaleString('nb-NO')}
                </p>
              )}
              {renamingId === m.machine_id ? (
                <RenameForm
                  machineId={m.machine_id}
                  current={m.machine_name}
                  onDone={() => setRenamingId(null)}
                />
              ) : (
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setRenamingId(m.machine_id)}
                    className="rounded px-3 py-1 text-xs bg-gray-700 hover:bg-gray-600 transition-colors"
                  >
                    Gi nytt navn
                  </button>
                  {m.has_active_token && (
                    <button
                      onClick={() => revokeMutation.mutate(m.machine_id)}
                      disabled={revokeMutation.isPending}
                      className="rounded px-3 py-1 text-xs bg-gray-700 hover:bg-red-800 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
                    >
                      Trekk tilbake token
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
