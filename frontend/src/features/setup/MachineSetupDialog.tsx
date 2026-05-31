import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listPhotographers, createPhotographer } from '../../api/photographers'
import { registerMachine } from '../../api/machines'
import { createShortcut } from '../../api/shortcuts'
import { browseDirectory } from '../../api/system'
import type { Photographer } from '../../types/api'

interface Props {
  onComplete: () => void
}

const inputCls = 'w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white text-sm outline-none focus:border-blue-500'

function PhotographerForm({
  value,
  onChange,
}: {
  value: { name: string; website: string; bio: string; notes: string }
  onChange: (v: typeof value) => void
}) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-gray-400 mb-1">Navn *</label>
        <input
          type="text"
          value={value.name}
          onChange={e => onChange({ ...value, name: e.target.value })}
          className={inputCls}
          placeholder="Ditt navn"
          autoFocus
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Nettside</label>
        <input
          type="text"
          value={value.website}
          onChange={e => onChange({ ...value, website: e.target.value })}
          className={inputCls}
          placeholder="https://…"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Bio</label>
        <textarea
          value={value.bio}
          onChange={e => onChange({ ...value, bio: e.target.value })}
          rows={2}
          className={inputCls + ' resize-none'}
          placeholder="Valgfritt"
        />
      </div>
      <div>
        <label className="block text-xs text-gray-400 mb-1">Notater</label>
        <textarea
          value={value.notes}
          onChange={e => onChange({ ...value, notes: e.target.value })}
          rows={2}
          className={inputCls + ' resize-none'}
          placeholder="Interne notater"
        />
      </div>
    </div>
  )
}

const emptyPhotographerForm = { name: '', website: '', bio: '', notes: '' }

export default function MachineSetupDialog({ onComplete }: Props) {
  const [machineName, setMachineName] = useState('')
  const [selectedId, setSelectedId] = useState('')
  const [showNewForm, setShowNewForm] = useState(false)
  const [newPhotographer, setNewPhotographer] = useState(emptyPhotographerForm)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data: photographers = [], isLoading } = useQuery<Photographer[]>({
    queryKey: ['photographers'],
    queryFn: listPhotographers,
  })

  useEffect(() => {
    if (photographers.length > 0 && !selectedId) {
      setSelectedId(photographers[0].id)
    }
  }, [photographers])

  const hasPhotographers = photographers.length > 0
  const creatingNew = !hasPhotographers || showNewForm

  async function handleSubmit() {
    setError('')

    if (!machineName.trim()) {
      setError('Skriv inn et navn for denne maskinen')
      return
    }

    if (creatingNew && !newPhotographer.name.trim()) {
      setError('Fotografnavnet kan ikke være tomt')
      return
    }

    if (!creatingNew && !selectedId) {
      setError('Velg en fotograf')
      return
    }

    setBusy(true)
    try {
      let photographerId = selectedId

      if (creatingNew) {
        const p = await createPhotographer({
          name: newPhotographer.name.trim(),
          website: newPhotographer.website.trim() || null,
          bio: newPhotographer.bio.trim() || null,
          notes: newPhotographer.notes.trim() || null,
        })
        photographerId = p.id
      }

      await registerMachine({
        machine_name: machineName.trim(),
        photographer_id: photographerId,
      })

      // Seed hjemmekatalog-snarvei via agenten — feiler stille
      try {
        const home = await browseDirectory('')
        await createShortcut({ name: 'Hjemmeområde', path: home.path })
      } catch {
        // Agenten er ikke tilgjengelig — snarvei kan legges til manuelt
      }

      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950 p-4 overflow-y-auto">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-8 space-y-6 my-auto">

        <div>
          <h1 className="text-xl font-bold text-white mb-1">Konfigurer denne maskinen</h1>
          <p className="text-sm text-gray-400">
            Første gang Hotprevue kjøres her. Fyll inn litt informasjon før du fortsetter.
          </p>
        </div>

        {/* Maskinnavn */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-1">
            Maskinnavn
          </label>
          <input
            type="text"
            value={machineName}
            onChange={e => setMachineName(e.target.value)}
            disabled={busy}
            className={inputCls}
            placeholder="f.eks. Beelink stue"
            autoFocus={hasPhotographers}
          />
        </div>

        {/* Fotograf */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-3">
            Standard fotograf
          </label>

          {isLoading && (
            <p className="text-sm text-gray-500">Laster fotografer…</p>
          )}

          {!isLoading && !hasPhotographers && (
            <>
              <p className="text-sm text-gray-400 mb-3">
                Ingen fotografer er opprettet ennå. Opprett din første:
              </p>
              <PhotographerForm value={newPhotographer} onChange={setNewPhotographer} />
            </>
          )}

          {!isLoading && hasPhotographers && !showNewForm && (
            <div className="space-y-2">
              <select
                value={selectedId}
                onChange={e => setSelectedId(e.target.value)}
                disabled={busy}
                className={inputCls}
              >
                {photographers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => { setShowNewForm(true); setNewPhotographer(emptyPhotographerForm) }}
                className="text-sm text-blue-400 hover:text-blue-300 transition-colors"
              >
                + Ny fotograf
              </button>
            </div>
          )}

          {!isLoading && hasPhotographers && showNewForm && (
            <div className="space-y-3">
              <PhotographerForm value={newPhotographer} onChange={setNewPhotographer} />
              <button
                type="button"
                onClick={() => setShowNewForm(false)}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
              >
                ← Avbryt, velg eksisterende
              </button>
            </div>
          )}
        </div>

        {error && (
          <p className="text-sm text-red-400">{error}</p>
        )}

        <button
          onClick={handleSubmit}
          disabled={busy || isLoading}
          className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
        >
          {busy ? 'Setter opp…' : 'Kom i gang →'}
        </button>

      </div>
    </div>
  )
}
