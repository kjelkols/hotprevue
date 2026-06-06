import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listPhotographers, createPhotographer } from '../../api/photographers'
import { scanDirectory } from '../../api/agent'
import DirectoryPicker from '../../components/DirectoryPicker'
import { getSettings } from '../../api/settings'
import { listVolumes } from '../../api/system'
import type { QuickScanResult } from './registrationTypes'

interface Props {
  onDone: (result: QuickScanResult) => void
}

export default function StepSetup({ onDone }: Props) {
  const [dirPath, setDirPath] = useState('')
  const [recursive, setRecursive] = useState(true)
  const [photographerId, setPhotographerId] = useState('')
  const [newPhotographerName, setNewPhotographerName] = useState('')
  const [creatingPhotographer, setCreatingPhotographer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data: photographers, refetch: refetchPhotographers } = useQuery({
    queryKey: ['photographers'], queryFn: listPhotographers,
  })
  const { data: settingsData, error: settingsError } = useQuery({
    queryKey: ['settings'], queryFn: getSettings, retry: 1,
  })
  const { data: volumes = [] } = useQuery({
    queryKey: ['volumes'], queryFn: listVolumes, staleTime: 10_000,
  })

  useEffect(() => {
    if (settingsData?.machine.default_photographer_id && !photographerId)
      setPhotographerId(settingsData.machine.default_photographer_id)
  }, [settingsData])

  const isRemovable = dirPath !== '' && volumes.some(
    v => dirPath === v.path || dirPath.startsWith(v.path + '/')
  )

  async function handleCreatePhotographer() {
    if (!newPhotographerName.trim()) return
    setCreatingPhotographer(true)
    setError('')
    try {
      const p = await createPhotographer({ name: newPhotographerName.trim() })
      await refetchPhotographers()
      setPhotographerId(p.id)
      setNewPhotographerName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke opprette fotograf')
    } finally {
      setCreatingPhotographer(false)
    }
  }

  async function handleAnalyze() {
    if (!dirPath) { setError('Velg en katalog'); return }
    if (!photographerId) { setError('Velg eller opprett en fotograf'); return }
    setBusy(true)
    setError('')
    try {
      const scan = await scanDirectory(dirPath, recursive)
      if (scan.groups.length === 0) { setError('Ingen bilder funnet i valgt katalog'); return }
      onDone({ scan, dirPath, photographerId, recursive })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Katalog</label>
        <div className="flex gap-2">
          <input type="text" value={dirPath} onChange={e => setDirPath(e.target.value)}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
            placeholder="Velg eller lim inn sti…" />
          <DirectoryPicker initialPath={dirPath} onSelect={path => setDirPath(path)}
            trigger={<button className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600">Bla…</button>} />
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-400">
          <input type="checkbox" checked={recursive} onChange={e => setRecursive(e.target.checked)} className="rounded" />
          Inkluder undermapper
        </label>
        {isRemovable && (
          <div className="mt-3 rounded-lg border border-yellow-800/60 bg-yellow-950/20 px-3 py-2 text-sm text-yellow-300">
            Dette ser ut som et minnekort. Kopier bildene til disk i{' '}
            <a href="#/preorganisering" className="underline hover:text-yellow-200">Preorganisering</a>
            {' '}før du registrerer, slik at stiene forblir gyldige.
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Fotograf</label>
        <select value={photographerId} onChange={e => setPhotographerId(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500">
          <option value="">— Velg fotograf —</option>
          {photographers?.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
        <div className="mt-2 flex gap-2">
          <input type="text" value={newPhotographerName} onChange={e => setNewPhotographerName(e.target.value)}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            placeholder="Ny fotograf…" onKeyDown={e => { if (e.key === 'Enter') handleCreatePhotographer() }} />
          <button onClick={handleCreatePhotographer}
            disabled={creatingPhotographer || !newPhotographerName.trim()}
            className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50">
            Opprett
          </button>
        </div>
      </div>

      {settingsError && (
        <p className="text-xs text-yellow-500">Kunne ikke hente maskininnstillinger</p>
      )}
      {error && <p className="text-sm text-red-400">{error}</p>}

      <button onClick={handleAnalyze} disabled={busy}
        className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
        {busy ? 'Skanner…' : 'Neste →'}
      </button>
    </div>
  )
}
