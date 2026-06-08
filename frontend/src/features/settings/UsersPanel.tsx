import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createInviteCode, listInviteCodes, deleteInviteCode,
  listPhotographersWithMachines, revokeMachineToken, setPhotographerAccessLevel,
} from '../../api/machineAuth'

const inp = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500'

function formatExpiry(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('no-NO', { hour: '2-digit', minute: '2-digit' }) +
    ' · ' + d.toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
}

function formatLastSeen(iso: string | null): string {
  if (!iso) return 'aldri'
  return new Date(iso).toLocaleDateString('no-NO', { day: 'numeric', month: 'short' })
}

function AccessBadge({ level }: { level: string }) {
  return level === 'owner'
    ? <span className="rounded px-1.5 py-0.5 text-xs bg-yellow-900 text-yellow-300">eier</span>
    : <span className="rounded px-1.5 py-0.5 text-xs bg-gray-700 text-gray-400">gjest</span>
}

// ---------------------------------------------------------------------------
// Invite form
// ---------------------------------------------------------------------------

function InviteForm({ onCode }: { onCode: (code: string) => void }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [level, setLevel] = useState<'guest' | 'owner'>('guest')
  const [ttl, setTtl] = useState(60)

  const mut = useMutation({
    mutationFn: () => createInviteCode({ photographer_name: name.trim() || undefined, access_level: level, ttl_minutes: ttl }),
    onSuccess: (code) => {
      onCode(code.code)
      setName('')
      qc.invalidateQueries({ queryKey: ['invite-codes'] })
    },
  })

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-gray-400">Fotografnavn (valgfritt)</label>
        <input className={inp} value={name} onChange={e => setName(e.target.value)} placeholder="f.eks. Anna" />
      </div>
      <div className="flex gap-4">
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="radio" name="level" value="guest" checked={level === 'guest'} onChange={() => setLevel('guest')} />
          Gjest — ser egne bilder
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
          <input type="radio" name="level" value="owner" checked={level === 'owner'} onChange={() => setLevel('owner')} />
          Eier — full tilgang
        </label>
      </div>
      <div className="flex items-center gap-3">
        <div>
          <label className="mb-1 block text-xs text-gray-400">Gyldig (minutter)</label>
          <input type="number" min={5} max={1440} className={`${inp} w-24`} value={ttl} onChange={e => setTtl(Number(e.target.value))} />
        </div>
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="mt-4 rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {mut.isPending ? 'Genererer…' : 'Generer kode'}
        </button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Registered users
// ---------------------------------------------------------------------------

function UserList() {
  const qc = useQueryClient()
  const { data: users = [] } = useQuery({ queryKey: ['photographers-with-machines'], queryFn: listPhotographersWithMachines })

  const revokeMut = useMutation({
    mutationFn: revokeMachineToken,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['photographers-with-machines'] }),
  })

  const accessMut = useMutation({
    mutationFn: ({ id, level }: { id: string; level: string }) => setPhotographerAccessLevel(id, level),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['photographers-with-machines'] }),
  })

  if (users.length === 0) return <p className="text-sm text-gray-600">Ingen registrerte brukere ennå.</p>

  return (
    <div className="space-y-3">
      {users.map(u => (
        <div key={u.id} className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3 space-y-2">
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{u.name}</span>
            <AccessBadge level={u.access_level} />
            {u.access_level === 'guest' ? (
              <button
                onClick={() => accessMut.mutate({ id: u.id, level: 'owner' })}
                className="ml-auto text-xs text-gray-500 hover:text-yellow-300 border border-gray-700 rounded px-2 py-0.5"
              >Gjør til eier</button>
            ) : (
              <button
                onClick={() => accessMut.mutate({ id: u.id, level: 'guest' })}
                className="ml-auto text-xs text-gray-500 hover:text-gray-300 border border-gray-700 rounded px-2 py-0.5"
              >Gjør til gjest</button>
            )}
          </div>
          <div className="space-y-1">
            {u.machines.map(m => (
              <div key={m.machine_id} className="flex items-center gap-2 text-sm text-gray-400">
                <span className="text-gray-500">↳</span>
                <span>{m.machine_name || '(ukjent)'}</span>
                <span className="text-xs text-gray-600 ml-auto">sist sett {formatLastSeen(m.last_seen_at)}</span>
                <button
                  onClick={() => revokeMut.mutate(m.machine_id)}
                  className="text-xs text-gray-600 hover:text-red-400 border border-gray-700 rounded px-2 py-0.5"
                  title="Trekk tilbake tilgang"
                >Trekk tilbake</button>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Active invite codes
// ---------------------------------------------------------------------------

function ActiveCodes() {
  const qc = useQueryClient()
  const { data: codes = [] } = useQuery({ queryKey: ['invite-codes'], queryFn: listInviteCodes })
  const deleteMut = useMutation({
    mutationFn: deleteInviteCode,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['invite-codes'] }),
  })

  const active = codes.filter(c => !c.used_at && new Date(c.expires_at) > new Date())
  if (active.length === 0) return null

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Aktive koder</h3>
      {active.map(c => (
        <div key={c.id} className="flex items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 px-4 py-2.5">
          <span className="font-mono font-bold tracking-widest text-white">{c.code}</span>
          {c.photographer_name && <span className="text-sm text-gray-400">{c.photographer_name}</span>}
          {c.access_level && <AccessBadge level={c.access_level} />}
          <span className="text-xs text-gray-600 ml-auto">utløper {formatExpiry(c.expires_at)}</span>
          <button onClick={() => deleteMut.mutate(c.id)} className="text-gray-600 hover:text-red-400 text-sm" title="Invalider">✕</button>
        </div>
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export default function UsersPanel() {
  const [newCode, setNewCode] = useState<string | null>(null)

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Inviter ny bruker</h3>
        <InviteForm onCode={setNewCode} />

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

      <ActiveCodes />

      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">Registrerte brukere</h3>
        <UserList />
      </div>
    </div>
  )
}
