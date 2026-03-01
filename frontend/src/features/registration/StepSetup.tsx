import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listPhotographers, createPhotographer } from '../../api/photographers'
import { createSession, checkPaths } from '../../api/inputSessions'
import { scanDirectory } from '../../api/system'
import FileBrowser from '../../components/FileBrowser'
import { getSettings } from '../../api/settings'
import { linkCopyToSession } from '../../api/fileCopy'
import CopySection from './CopySection'
import { winToWsl } from '../../utils/paths'
import type { FileGroup, ScanResult } from '../../types/api'

interface Props {
  onDone: (sessionId: string, scan: ScanResult, unknownGroups: FileGroup[]) => void
}

function defaultSessionName(): string {
  return `Registrering ${new Date().toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}`
}

export default function StepSetup({ onDone }: Props) {
  const [sessionName, setSessionName] = useState(defaultSessionName)
  const [dirPath, setDirPath] = useState('')
  const [recursive, setRecursive] = useState(true)
  const [photographerId, setPhotographerId] = useState('')
  const [notes, setNotes] = useState('')
  const [newPhotographerName, setNewPhotographerName] = useState('')
  const [creatingPhotographer, setCreatingPhotographer] = useState(false)
  const [sourceMode, setSourceMode] = useState<'manual' | 'copy'>('manual')
  const [copyOperationId, setCopyOperationId] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data: photographers, refetch: refetchPhotographers } = useQuery({
    queryKey: ['photographers'],
    queryFn: listPhotographers
  })

  const { data: settingsData } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })

  useEffect(() => {
    if (settingsData?.machine.default_photographer_id && !photographerId) {
      setPhotographerId(settingsData.machine.default_photographer_id)
    }
  }, [settingsData])

  function handleModeChange(mode: 'manual' | 'copy') {
    setSourceMode(mode)
    if (mode === 'manual') {
      setCopyOperationId(null)
      setDirPath('')
    }
  }

  function handleDirInput(raw: string) {
    setDirPath(winToWsl(raw))
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
        recursive,
        notes: notes.trim() || null,
      })

      if (copyOperationId) {
        await linkCopyToSession(copyOperationId, session.id)
      }

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
        <label className="mb-2 block text-sm font-medium text-gray-300">Katalog</label>

        <div className="mb-3 flex overflow-hidden rounded-lg border border-gray-700 text-sm">
          <button
            type="button"
            onClick={() => handleModeChange('manual')}
            disabled={!!copyOperationId}
            className={`flex-1 px-3 py-1.5 transition-colors disabled:opacity-50 ${
              sourceMode === 'manual' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >Velg katalog</button>
          <button
            type="button"
            onClick={() => handleModeChange('copy')}
            disabled={!!copyOperationId}
            className={`flex-1 border-l border-gray-700 px-3 py-1.5 transition-colors disabled:opacity-50 ${
              sourceMode === 'copy' ? 'bg-gray-700 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'
            }`}
          >Kopier fra kilde</button>
        </div>

        {sourceMode === 'manual' && (
          <div className="flex gap-2">
            <input
              type="text"
              value={dirPath}
              onChange={e => handleDirInput(e.target.value)}
              className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
              placeholder="Lim inn sti, f.eks. C:\Bilder\Ferie2025"
            />
            <FileBrowser
              initialPath={dirPath}
              onSelect={setDirPath}
              trigger={
                <button className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600">
                  Bla…
                </button>
              }
            />
          </div>
        )}

        {sourceMode === 'copy' && !copyOperationId && (
          <CopySection
            onCopyCompleted={(destPath, opId) => {
              setDirPath(destPath)
              setCopyOperationId(opId)
            }}
          />
        )}

        {sourceMode === 'copy' && copyOperationId && (
          <div className="flex items-center gap-2 rounded-lg border border-green-700 bg-green-900/20 px-3 py-2 text-sm">
            <span className="text-green-400">✓</span>
            <span className="flex-1 truncate font-mono text-green-300">{dirPath}</span>
            <button
              type="button"
              onClick={() => { setCopyOperationId(null); setDirPath('') }}
              className="shrink-0 text-xs text-gray-400 hover:text-white"
            >Nullstill</button>
          </div>
        )}

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

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Notater <span className="text-gray-500 font-normal">(valgfritt)</span></label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500 resize-none"
          placeholder="Fritekst om denne registreringen…"
        />
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
