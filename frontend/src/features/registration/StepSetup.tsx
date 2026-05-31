import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listPhotographers, createPhotographer } from '../../api/photographers'
import { createSession, checkHothashes } from '../../api/inputSessions'
import { scanDirectory, hashFile } from '../../api/agent'
import FileBrowser from '../../components/FileBrowser'
import { getSettings } from '../../api/settings'
import { listVolumes } from '../../api/system'
import CopySection from './CopySection'
import type { FileGroup, ScanResult } from '../../types/api'

interface Props {
  onDone: (sessionId: string, scan: ScanResult, unknownGroups: FileGroup[]) => void
}

function defaultSessionName(): string {
  const now = new Date()
  const date = now.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
  return `Registrering ${date} ${time}`
}

export default function StepSetup({ onDone }: Props) {
  const [sessionName, setSessionName] = useState(defaultSessionName)
  const [dirPath, setDirPath] = useState('')
  const [recursive, setRecursive] = useState(true)
  const [photographerId, setPhotographerId] = useState('')
  const [notes, setNotes] = useState('')
  const [newPhotographerName, setNewPhotographerName] = useState('')
  const [creatingPhotographer, setCreatingPhotographer] = useState(false)
  const [copiedDest, setCopiedDest] = useState<string | null>(null)
  const [acknowledgedCardScan, setAcknowledgedCardScan] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const { data: photographers, refetch: refetchPhotographers } = useQuery({
    queryKey: ['photographers'],
    queryFn: listPhotographers,
  })

  const { data: settingsData, error: settingsError } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
    retry: 1,
  })

  const { data: volumes = [] } = useQuery({
    queryKey: ['volumes'],
    queryFn: listVolumes,
    staleTime: 10_000,
  })

  useEffect(() => {
    if (settingsData?.machine.default_photographer_id && !photographerId) {
      setPhotographerId(settingsData.machine.default_photographer_id)
    }
  }, [settingsData])

  // Minnekort oppdaget hvis valgt sti er under et kjent volum
  const isRemovable = dirPath !== '' && volumes.some(
    v => dirPath === v.path || dirPath.startsWith(v.path + '/')
  )

  // Den faktiske stien som skal skannes
  const effectivePath = copiedDest ?? dirPath

  function handleDirSelect(path: string) {
    setDirPath(path)
    setCopiedDest(null)
    setAcknowledgedCardScan(false)
  }

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

  async function handleNext() {
    if (!sessionName.trim()) { setError('Oppgi et navn for registreringen'); return }
    if (!effectivePath) { setError('Velg en katalog'); return }
    if (!photographerId) { setError('Velg eller opprett en fotograf'); return }

    setBusy(true)
    setError('')
    try {
      const scan = await scanDirectory(effectivePath, recursive)

      const session = await createSession({
        name: sessionName.trim(),
        source_path: effectivePath,
        default_photographer_id: photographerId,
        recursive,
        notes: notes.trim() || null,
      })

      const hashResults = await Promise.all(
        scan.groups.map(g => hashFile(g.master_path).then(r => ({ group: g, hothash: r.hothash })))
      )

      const hothashes = hashResults.map(r => r.hothash)
      const check = await checkHothashes(session.id, hothashes)

      const unknownSet = new Set(check.unknown)
      const unknownGroups = hashResults
        .filter(r => unknownSet.has(r.hothash))
        .map(r => r.group)

      onDone(session.id, scan, unknownGroups)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">

      {/* Navn */}
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

      {/* Katalog */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Katalog</label>

        <div className="flex gap-2">
          <input
            type="text"
            value={dirPath}
            onChange={e => handleDirSelect(e.target.value)}
            className="flex-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
            placeholder="Velg eller lim inn sti…"
          />
          <FileBrowser
            initialPath={dirPath}
            onSelect={handleDirSelect}
            trigger={
              <button className="rounded-lg bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600">
                Bla…
              </button>
            }
          />
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

        {/* Minnekort — kopieringssteg */}
        {isRemovable && !copiedDest && (
          <CopySection
            sourcePath={dirPath}
            sessionName={sessionName}
            onCopyCompleted={setCopiedDest}
          />
        )}

        {/* Advarsel ved skanning direkte fra kort */}
        {isRemovable && !copiedDest && dirPath && (
          <div className="mt-3 rounded-lg border border-yellow-700 bg-yellow-950/30 p-3 space-y-2">
            <p className="text-sm text-yellow-300">
              Bildene er ikke kopiert til lokal disk. Hvis kortet fjernes eller formateres etter registreringen, vil de registrerte stiene være ugyldige og bildene utilgjengelige.
            </p>
            <label className="flex items-start gap-2 text-sm text-yellow-200 cursor-pointer select-none">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked={acknowledgedCardScan}
                onChange={e => setAcknowledgedCardScan(e.target.checked)}
              />
              Jeg forstår at bildene forblir på minnekortet og ikke kopieres
            </label>
          </div>
        )}

        {/* Etter vellykket kopiering */}
        {isRemovable && copiedDest && (
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-green-700 bg-green-900/20 px-3 py-2 text-sm">
            <span className="text-green-400">✓</span>
            <span className="flex-1 truncate font-mono text-green-300">{copiedDest}</span>
            <button
              type="button"
              onClick={() => { setCopiedDest(null); setAcknowledgedCardScan(false) }}
              className="shrink-0 text-xs text-gray-400 hover:text-white"
            >Kopier på nytt</button>
          </div>
        )}

        {/* Hvilken sti som faktisk skannes */}
        {isRemovable && copiedDest && (
          <p className="mt-1 text-xs text-gray-500">Skanner fra: <span className="font-mono">{copiedDest}</span></p>
        )}
      </div>

      {/* Fotograf */}
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

      {/* Notater */}
      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">
          Notater <span className="text-gray-500 font-normal">(valgfritt)</span>
        </label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500 resize-none"
          placeholder="Fritekst om denne registreringen…"
        />
      </div>

      {settingsError && (
        <p className="text-xs text-yellow-500">
          Kunne ikke hente maskininnstillinger: {settingsError instanceof Error ? settingsError.message : 'ukjent feil'}
        </p>
      )}

      {error && <p className="text-sm text-red-400">{error}</p>}

      <button
        onClick={handleNext}
        disabled={busy || (isRemovable && !copiedDest && !acknowledgedCardScan)}
        className="w-full rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
      >
        {busy ? 'Skanner…' : 'Skann og fortsett →'}
      </button>
    </div>
  )
}
