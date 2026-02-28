import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listPhotographers, createPhotographer } from '../../api/photographers'
import { createSession, checkPaths } from '../../api/inputSessions'
import { pickDirectory, scanDirectory } from '../../api/system'
import type { FileGroup, ScanResult } from '../../types/api'

interface Props {
  onDone: (sessionId: string, scan: ScanResult, unknownGroups: FileGroup[]) => void
}

export default function StepSetup({ onDone }: Props) {
  const [sessionName, setSessionName] = useState('')
  const [dirPath, setDirPath] = useState('')
  const [recursive, setRecursive] = useState(true)
  const [photographerId, setPhotographerId] = useState('')
  const [newPhotographerName, setNewPhotographerName] = useState('')
  const [creatingPhotographer, setCreatingPhotographer] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data: photographers, refetch: refetchPhotographers } = useQuery({
    queryKey: ['photographers'],
    queryFn: listPhotographers
  })

  async function handlePickDirectory() {
    const result = await pickDirectory()
    if (result.path) setDirPath(result.path)
  }

  async function handleCreatePhotographer() {
    if (!newPhotographerName.trim()) return
    setCreatingPhotographer(true)
    setError('')
    try {
      const p = await createPhotographer(newPhotographerName.trim())
      await refetchPhotographers()
      setPhotographerId(p.id)
      setNewPhotographerName('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Kunne ikke opprette fotograf')
    } finally {
      setCreatingPhotographer(false)
    }
  }

  async function handleNext() {
    if (!sessionName.trim()) { setError('Oppgi et navn for registreringen'); return }
    if (!dirPath) { setError('Velg en katalog'); return }
    if (!photographerId) { setError('Velg eller opprett en fotograf'); return }

    setBusy(true)
    setError('')
    try {
      // Scan directory
      const scan = await scanDirectory(dirPath, recursive)

      // Create session
      const session = await createSession({
        name: sessionName.trim(),
        source_path: dirPath,
        default_photographer_id: photographerId,
        recursive
      })

      // Check which master paths are already known
      const masterPaths = scan.groups.map(g => g.master_path)
      const check = await checkPaths(session.id, masterPaths)

      const unknownSet = new Set(check.unknown)
      const unknownGroups = scan.groups.filter(g => unknownSet.has(g.master_path))

      onDone(session.id, scan, unknownGroups)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Navn på registrering</label>
        <input
          type="text"
          value={sessionName}
          onChange={e => setSessionName(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
          placeholder="f.eks. Sommerfest 2025"
        />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Katalog</label>
        <div className="flex gap-2">
          <input
            type="text"
            value={dirPath}
            readOnly
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-gray-300 outline-none"
            placeholder="Ingen katalog valgt"
          />
          <button
            onClick={handlePickDirectory}
            className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
          >
            Velg…
          </button>
        </div>
        <label className="mt-2 flex items-center gap-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={recursive}
            onChange={e => setRecursive(e.target.checked)}
            className="rounded"
          />
          Inkluder undermapper
        </label>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Fotograf</label>
        <select
          value={photographerId}
          onChange={e => setPhotographerId(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
        >
          <option value="">— Velg fotograf —</option>
          {photographers?.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>

        <div className="mt-2 flex gap-2">
          <input
            type="text"
            value={newPhotographerName}
            onChange={e => setNewPhotographerName(e.target.value)}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            placeholder="Ny fotograf…"
            onKeyDown={e => { if (e.key === 'Enter') handleCreatePhotographer() }}
          />
          <button
            onClick={handleCreatePhotographer}
            disabled={creatingPhotographer || !newPhotographerName.trim()}
            className="rounded-lg bg-gray-700 px-3 py-2 text-sm font-medium text-white hover:bg-gray-600 disabled:opacity-50"
          >
            Opprett
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handleNext}
        disabled={busy}
        className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {busy ? 'Skanner…' : 'Skann og fortsett →'}
      </button>
    </div>
  )
}
