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

type PhotographerMode = 'select' | 'create'

export default function MachineSetupDialog({ onComplete }: Props) {
  const [machineName, setMachineName] = useState('')
  const [mode, setMode] = useState<PhotographerMode>('create')
  const [selectedId, setSelectedId] = useState('')
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data: photographers = [], isLoading } = useQuery<Photographer[]>({
    queryKey: ['photographers'],
    queryFn: listPhotographers,
  })

  useEffect(() => {
    if (photographers.length > 0) {
      setMode('select')
      if (!selectedId) setSelectedId(photographers[0].id)
    } else {
      setMode('create')
    }
  }, [photographers])

  async function handleSubmit() {
    if (!machineName.trim()) {
      setError('Skriv inn et navn for denne maskinen')
      return
    }
    if (mode === 'select' && !selectedId) {
      setError('Velg en fotograf')
      return
    }
    if (mode === 'create' && !newName.trim()) {
      setError('Skriv inn ditt navn')
      return
    }

    setBusy(true)
    setError('')

    try {
      let photographerId = selectedId

      if (mode === 'create') {
        const p = await createPhotographer({ name: newName.trim() })
        photographerId = p.id
      }

      await registerMachine({
        machine_name: machineName.trim(),
        photographer_id: photographerId,
      })

      // Seed hjemmekatalog som standard snarvei — valgfritt, feiler stille
      try {
        const home = await browseDirectory('')
        await createShortcut({ name: 'Hjemmeområde', path: home.path })
      } catch {
        // Agenten kjører ikke — OK, snarvei kan legges til manuelt
      }

      onComplete()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt')
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-950 p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-700 bg-gray-900 p-8 space-y-6">

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
            onKeyDown={e => e.key === 'Enter' && handleSubmit()}
            className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
            placeholder="f.eks. Beelink stue"
            autoFocus
            disabled={busy}
          />
        </div>

        {/* Fotograf */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Standard fotograf
          </label>

          {!isLoading && photographers.length > 0 && (
            <div className="flex gap-2 mb-3">
              <button
                type="button"
                onClick={() => setMode('select')}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  mode === 'select'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Velg eksisterende
              </button>
              <button
                type="button"
                onClick={() => setMode('create')}
                className={`px-3 py-1 rounded-lg text-sm transition-colors ${
                  mode === 'create'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-800 text-gray-400 hover:text-white'
                }`}
              >
                Opprett ny
              </button>
            </div>
          )}

          {isLoading && (
            <p className="text-sm text-gray-500">Laster fotografer…</p>
          )}

          {!isLoading && mode === 'select' && photographers.length > 0 && (
            <select
              value={selectedId}
              onChange={e => setSelectedId(e.target.value)}
              disabled={busy}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
            >
              {photographers.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          )}

          {!isLoading && mode === 'create' && (
            <input
              type="text"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              disabled={busy}
              className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
              placeholder="Ditt navn"
            />
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
