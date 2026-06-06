import { useEffect, useMemo, useState } from 'react'
import { lookupFolderEvents } from '../../api/system'
import NamingOptionsPanel from './NamingOptionsPanel'
import {
  computeFolderEntries,
  DEFAULT_NAMING_OPTIONS,
  type AnalyzeResult,
  type FolderMapping,
  type NamingOptions,
} from './registrationTypes'

interface Props {
  result: AnalyzeResult
  onDone: (sessionName: string, mappings: FolderMapping[]) => void
  onBack: () => void
}

function defaultSessionName(): string {
  const now = new Date()
  const date = now.toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })
  const time = now.toLocaleTimeString('nb-NO', { hour: '2-digit', minute: '2-digit' })
  return `Registrering ${date} ${time}`
}

export default function StepFolderMap({ result, onDone, onBack }: Props) {
  const { scan, unknownGroups, dirPath, photographerId, recursive } = result

  const [options, setOptions] = useState<NamingOptions>(DEFAULT_NAMING_OPTIONS)
  const [sessionName, setSessionName] = useState(defaultSessionName)
  const [error, setError] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [existingEvents, setExistingEvents] = useState<Record<string, { id: string; name: string } | null>>({})

  const baseEntries = useMemo(
    () => computeFolderEntries(scan.groups, unknownGroups, dirPath, options),
    [scan.groups, unknownGroups, dirPath, options],
  )

  // Folder paths are stable across option changes — compute once for lookup
  const stablePaths = useMemo(
    () => computeFolderEntries(scan.groups, unknownGroups, dirPath, DEFAULT_NAMING_OPTIONS).map(e => e.folderPath),
    [scan.groups, unknownGroups, dirPath],
  )

  const [eventNames, setEventNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(baseEntries.map(e => [e.relPath, e.eventName]))
  )

  // Fetch existing events on mount (once per directory analysis)
  useEffect(() => {
    if (stablePaths.length === 0) return
    setLookupLoading(true)
    lookupFolderEvents(stablePaths)
      .then(({ matches }) => {
        const map: Record<string, { id: string; name: string } | null> = {}
        for (const m of matches) map[m.path] = m.event

        setExistingEvents(map)
        // Pre-fill event names from existing events where the derived name hasn't been customised
        setEventNames(prev => {
          const updated = { ...prev }
          for (const entry of baseEntries) {
            const existing = map[entry.folderPath]
            if (existing && updated[entry.relPath] === entry.eventName) {
              updated[entry.relPath] = existing.name
            }
          }
          return updated
        })
      })
      .catch(() => { /* non-fatal — proceed without lookup */ })
      .finally(() => setLookupLoading(false))
  }, [stablePaths])

  function handleOptionsChange(opts: NamingOptions) {
    setOptions(opts)
    const recomputed = computeFolderEntries(scan.groups, unknownGroups, dirPath, opts)
    setEventNames(prev => {
      const updated: Record<string, string> = {}
      for (const entry of recomputed) {
        const existing = existingEvents[entry.folderPath]
        updated[entry.relPath] = existing?.name ?? entry.eventName
      }
      return updated
    })
  }

  function handleNameChange(relPath: string, name: string) {
    setEventNames(prev => ({ ...prev, [relPath]: name }))
  }

  function handleStart() {
    if (!sessionName.trim()) { setError('Oppgi et navn for registreringen'); return }

    const mappings: FolderMapping[] = baseEntries.map(entry => {
      const name = (eventNames[entry.relPath] ?? '').trim()
      const existing = existingEvents[entry.folderPath]
      const reuseExisting = !!existing && name === existing.name
      return {
        folderPath: entry.folderPath,
        eventName: name,
        existingEventId: reuseExisting ? existing.id : null,
      }
    })

    onDone(sessionName.trim(), mappings)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3 text-sm text-gray-300">
        <span className="font-medium text-white">{unknownGroups.length}</span> nye av{' '}
        <span className="font-medium text-white">{scan.groups.length}</span> bilder i{' '}
        <span className="font-mono text-gray-400">{dirPath}</span>
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium text-gray-300">Navn på registrering</label>
        <input
          type="text"
          value={sessionName}
          onChange={e => setSessionName(e.target.value)}
          className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-white outline-none focus:border-blue-500"
        />
      </div>

      <div>
        <div className="mb-2">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-300">Katalogkart</span>
            {lookupLoading && <span className="text-xs text-gray-500">Slår opp events…</span>}
          </div>
          <NamingOptionsPanel options={options} onChange={handleOptionsChange} />
        </div>

        <div className="overflow-x-auto rounded-xl border border-gray-700">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-700 bg-gray-900 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
                <th className="px-4 py-2">Katalog</th>
                <th className="px-4 py-2">Event</th>
                <th className="px-4 py-2 text-right">Totalt</th>
                <th className="px-4 py-2 text-right">Nye</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 bg-gray-900">
              {baseEntries.map(entry => {
                const currentName = eventNames[entry.relPath] ?? ''
                const existing = existingEvents[entry.folderPath]
                const isExisting = !!existing && currentName === existing.name
                const lastSlash = entry.relPath.lastIndexOf('/')
                const parentPart = lastSlash >= 0 ? entry.relPath.slice(0, lastSlash + 1) : ''
                return (
                  <tr key={entry.relPath} className={entry.newCount === 0 ? 'opacity-40' : ''}>
                    <td className="px-4 py-2 text-sm font-mono whitespace-nowrap">
                      {entry.relPath === '' ? (
                        <span className="italic text-gray-600">rotkatalog</span>
                      ) : (
                        <>
                          {parentPart && <span className="text-gray-600">{parentPart}</span>}
                          <span className="text-gray-300">{entry.folderName}</span>
                        </>
                      )}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          value={currentName}
                          onChange={e => handleNameChange(entry.relPath, e.target.value)}
                          placeholder="(ingen event)"
                          className="min-w-40 flex-1 rounded border border-gray-700 bg-gray-800 px-2 py-1 text-sm text-white outline-none focus:border-blue-500 placeholder:text-gray-600"
                        />
                        {isExisting && (
                          <span className="shrink-0 rounded-full border border-green-700/50 bg-green-900/40 px-2 py-0.5 text-xs text-green-400">
                            Eksisterende
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2 text-right text-sm text-gray-500 tabular-nums">{entry.totalCount}</td>
                    <td className="px-4 py-2 text-right text-sm tabular-nums">
                      {entry.newCount > 0
                        ? <span className="font-medium text-blue-400">{entry.newCount}</span>
                        : <span className="text-gray-600">0</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}

      <div className="flex gap-3">
        <button onClick={onBack} className="rounded-xl border border-gray-700 px-4 py-3 text-sm text-gray-400 hover:bg-gray-800">
          ← Tilbake
        </button>
        <button
          onClick={handleStart}
          disabled={lookupLoading}
          className="flex-1 rounded-xl bg-blue-600 py-3 font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {`Neste: bekreft (${unknownGroups.length} bilder) →`}
        </button>
      </div>
    </div>
  )
}
