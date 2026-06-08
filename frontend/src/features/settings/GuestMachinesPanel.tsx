import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createInviteCode, listInviteCodes, deleteInviteCode,
  listMachinesAdmin, revokeMachineToken,
} from '../../api/machineAuth'

const inp = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500'

function formatExpiry(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }) +
    ' · ' + d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
}

export default function GuestMachinesPanel() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [ttl, setTtl] = useState(60)
  const [newCode, setNewCode] = useState<string | null>(null)

  const { data: codes = [] } = useQuery({ queryKey: ['invite-codes'], queryFn: listInviteCodes })
  const { data: machines = [] } = useQuery({ queryKey: ['machines-admin'], queryFn: listMachinesAdmin })

  const createMut = useMutation({
    mutationFn: () => createInviteCode({ photographer_name: name.trim() || undefined, ttl_minutes: ttl, role: 'guest' }),
    onSuccess: (code) => {
      setNewCode(code.code)
      setName('')
      qc.invalidateQueries({ queryKey: ['invite-codes'] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: deleteInviteCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invite-codes'] }),
  })

  const revokeMut = useMutation({
    mutationFn: revokeMachineToken,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['machines-admin'] }),
  })

  const activeCodes = codes.filter(c => !c.used_at && new Date(c.expires_at) > new Date())
  const guestMachines = machines.filter(m => m.role === 'guest')

  return (
    <div className="space-y-8">
      {/* Generer kode */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Inviter gjestfotograf</h3>
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs text-gray-400">Fotografnavn (valgfritt)</label>
            <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="f.eks. Anna" />
          </div>
          <div>
            <label className="mb-1 block text-xs text-gray-400">Koden gjelder i (minutter)</label>
            <input type="number" min={5} max={1440} className={`${inp} w-28`} value={ttl} onChange={e => setTtl(Number(e.target.value))} />
          </div>
          <button
            onClick={() => createMut.mutate()}
            disabled={createMut.isPending}
            className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {createMut.isPending ? 'Genererer…' : 'Generer kode'}
          </button>
        </div>

        {newCode && (
          <div className="rounded-xl border border-green-700 bg-green-950 px-5 py-4 flex items-center gap-4">
            <span className="font-mono text-2xl font-bold tracking-[0.2em] text-green-300">{newCode}</span>
            <button
              onClick={() => navigator.clipboard.writeText(newCode)}
              className="text-xs text-green-400 hover:text-white border border-green-700 rounded px-2 py-1"
            >Kopier</button>
            <button onClick={() => setNewCode(null)} className="ml-auto text-green-700 hover:text-white text-lg">✕</button>
          </div>
        )}
      </div>

      {/* Aktive koder */}
      {activeCodes.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Aktive koder</h3>
          {activeCodes.map(c => (
            <div key={c.id} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5">
              <span className="font-mono font-bold tracking-widest text-white">{c.code}</span>
              {c.photographer_name && <span className="text-sm text-gray-400">{c.photographer_name}</span>}
              <span className="text-xs text-gray-600 ml-auto">utløper {formatExpiry(c.expires_at)}</span>
              <button onClick={() => deleteMut.mutate(c.id)} className="text-gray-600 hover:text-red-400 text-sm" title="Invalider">✕</button>
            </div>
          ))}
        </div>
      )}

      {/* Registrerte gjester */}
      {guestMachines.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Gjestmaskiner</h3>
          {guestMachines.map(m => (
            <div key={m.machine_id} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5">
              <span className="text-sm text-white">{m.machine_name || '(ukjent)'}</span>
              {m.last_seen_at && (
                <span className="text-xs text-gray-500 ml-auto">sist sett {new Date(m.last_seen_at).toLocaleDateString('no-NO')}</span>
              )}
              <button
                onClick={() => revokeMut.mutate(m.machine_id)}
                className="text-xs text-gray-500 hover:text-red-400 border border-gray-700 rounded px-2 py-1"
                title="Trekk tilbake tilgang"
              >Trekk tilbake</button>
            </div>
          ))}
        </div>
      )}

      {activeCodes.length === 0 && guestMachines.length === 0 && (
        <p className="text-sm text-gray-600">Ingen aktive koder eller gjestmaskiner.</p>
      )}
    </div>
  )
}
