import { useEffect, useRef, useState } from 'react'
import { suggestName, startCopy, getCopyOperation, cancelCopyOperation, eraseCopySource } from '../../api/fileCopy'
import FileBrowser from '../../components/FileBrowser'
import type { AgentCopyOperation } from '../../types/api'

interface Props {
  sourcePath: string
  sessionName?: string
  onCopyCompleted: (destinationPath: string) => void
}

function sanitizeDirName(name: string): string {
  return name
    .toLowerCase()
    .replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/å/g, 'aa')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    || 'registrering'
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export default function CopySection({ sourcePath, sessionName, onCopyCompleted }: Props) {
  // Ref slik at useEffect for sourcePath alltid ser siste sessionName
  // uten å bli re-trigget hver gang brukeren skriver i navnefeltet
  const sessionNameRef = useRef(sessionName)
  sessionNameRef.current = sessionName
  const [parentDir, setParentDir] = useState('')
  const [dirName, setDirName] = useState('')
  const [filesFound, setFilesFound] = useState<number | null>(null)
  const [bytesTotal, setBytesTotal] = useState<number | null>(null)
  const [deviceLabel, setDeviceLabel] = useState('')
  const [operation, setOperation] = useState<AgentCopyOperation | null>(null)
  const [showSkips, setShowSkips] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [eraseChecked, setEraseChecked] = useState(false)
  const [erasing, setErasing] = useState(false)
  const [eraseResult, setEraseResult] = useState<{ deleted: number; errors: number } | null>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Hent EXIF-dato og filinfo automatisk når kilden endres
  useEffect(() => {
    if (!sourcePath) return
    setScanning(true)
    setFilesFound(null)
    setBytesTotal(null)
    setOperation(null)
    setEraseResult(null)
    setEraseChecked(false)
    suggestName(sourcePath)
      .then(r => {
        setFilesFound(r.files_found)
        setBytesTotal(r.bytes_total)
        if (r.suggested_name) {
          setDirName(r.suggested_name)
        } else if (sessionNameRef.current) {
          setDirName(sanitizeDirName(sessionNameRef.current))
        }
      })
      .catch(() => {
        if (sessionNameRef.current) setDirName(sanitizeDirName(sessionNameRef.current))
      })
      .finally(() => setScanning(false))
  }, [sourcePath])

  // Poll under kopiering
  useEffect(() => {
    if (!operation) return
    if (['completed', 'failed', 'cancelled'].includes(operation.status)) return

    pollRef.current = setInterval(async () => {
      const updated = await getCopyOperation(operation.id)
      setOperation(updated)
      if (['completed', 'failed', 'cancelled'].includes(updated.status)) {
        clearInterval(pollRef.current!)
        if (updated.status === 'completed') {
          onCopyCompleted(updated.destination_path)
        }
      }
    }, 800)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [operation?.id, operation?.status])

  async function handleStart() {
    if (!sourcePath || !parentDir || !dirName) return
    const destPath = parentDir.replace(/\/+$/, '') + '/' + dirName
    const op = await startCopy({
      source_path: sourcePath,
      destination_path: destPath,
      device_label: deviceLabel || undefined,
    })
    setOperation(op)
  }

  async function handleErase() {
    if (!operation) return
    setErasing(true)
    try {
      const result = await eraseCopySource(operation.id)
      setEraseResult(result)
    } finally {
      setErasing(false)
    }
  }

  const destPath = parentDir && dirName ? parentDir.replace(/\/+$/, '') + '/' + dirName : ''
  const isRunning = operation && ['pending', 'running'].includes(operation.status)
  const isDone = operation?.status === 'completed'
  const progress = operation && operation.bytes_total > 0
    ? operation.bytes_copied / operation.bytes_total
    : 0

  return (
    <div className="mt-3 rounded-lg border border-orange-800/50 bg-orange-950/20 p-4 space-y-3">
      <p className="text-xs font-medium text-orange-300 uppercase tracking-wide">Minnekort oppdaget — kopier til lokal katalog</p>

      {/* Kildeinformasjon */}
      <div className="text-xs text-gray-400 font-mono">
        {scanning ? 'Skanner kilde…' : filesFound !== null
          ? `${filesFound} filer · ${formatBytes(bytesTotal ?? 0)}`
          : null}
      </div>

      {/* Destinasjon */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">Kopier til</label>
        <div className="flex gap-2 mb-1">
          <input
            className="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm font-mono text-white"
            value={parentDir}
            onChange={e => setParentDir(e.target.value)}
            placeholder="Velg overmappe…"
            disabled={!!operation}
          />
          <FileBrowser
            initialPath={parentDir}
            onSelect={setParentDir}
            trigger={
              <button
                type="button"
                className="rounded border border-gray-600 bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600 disabled:opacity-40"
                disabled={!!operation}
              >Bla…</button>
            }
          />
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-500 select-none">/</span>
          <input
            className="flex-1 rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm font-mono text-white"
            value={dirName}
            onChange={e => setDirName(e.target.value)}
            placeholder="katalognavn"
            disabled={!!operation}
          />
        </div>
        {destPath && (
          <p className="mt-1 text-xs text-gray-500 font-mono truncate">→ {destPath}</p>
        )}
      </div>

      {/* Enhetsnavn */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-1">
          Enhetsnavn <span className="font-normal text-gray-500">(valgfritt)</span>
        </label>
        <input
          className="w-full rounded border border-gray-600 bg-gray-800 px-3 py-1.5 text-sm text-white"
          value={deviceLabel}
          onChange={e => setDeviceLabel(e.target.value)}
          placeholder="Sony A7IV kort 1"
          disabled={!!operation}
        />
      </div>

      {/* Fremdrift */}
      {operation && (
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-gray-700">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-sm text-gray-400">
            {operation.files_copied} av {operation.files_total} filer
            {' · '}{formatBytes(operation.bytes_copied)} av {formatBytes(operation.bytes_total)}
          </p>
          {operation.status === 'failed' && (
            <p className="text-sm text-red-400">{operation.error}</p>
          )}
          {isDone && (
            <p className="text-sm text-green-400">
              ✓ {operation.files_copied} filer kopiert og verifisert
              {operation.files_skipped > 0 && ` · ${operation.files_skipped} hoppet over`}
            </p>
          )}
        </div>
      )}

      {/* Hoppede over */}
      {isDone && operation.skips.length > 0 && (
        <div>
          <button
            type="button"
            className="text-sm text-blue-400 underline"
            onClick={() => setShowSkips(v => !v)}
          >
            {showSkips ? 'Skjul' : 'Vis'} hoppede over ({operation.skips.length})
          </button>
          {showSkips && (
            <ul className="mt-2 max-h-32 overflow-y-auto rounded border border-gray-700 bg-gray-800 text-xs divide-y divide-gray-700">
              {operation.skips.map((s, i) => (
                <li key={i} className="px-2 py-1 flex gap-2">
                  <span className="text-gray-500 shrink-0">{s.reason}</span>
                  <span className="font-mono truncate text-gray-300">{s.source_path}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Slett kildefiler — kun tilgjengelig etter fullført og verifisert kopiering */}
      {isDone && !eraseResult && (
        <div className="rounded border border-red-900/50 bg-red-950/20 p-3 space-y-2">
          <p className="text-xs text-gray-400">
            {operation!.files_copied} av {operation!.files_total} filer ble kopiert og SHA256-verifisert.
            {operation!.files_skipped > 0 && (
              <span className="text-yellow-400"> {operation!.files_skipped} hoppede over filer forblir urørt på kortet.</span>
            )}
          </p>
          <label className="flex items-start gap-2 text-sm text-gray-300 cursor-pointer select-none">
            <input
              type="checkbox"
              className="mt-0.5 rounded shrink-0"
              checked={eraseChecked}
              onChange={e => setEraseChecked(e.target.checked)}
            />
            <span>
              Slett de {operation!.files_copied} verifiserte kildefilene fra minnekortet
            </span>
          </label>
          {eraseChecked && (
            <button
              type="button"
              onClick={handleErase}
              disabled={erasing}
              className="rounded bg-red-700 px-3 py-1.5 text-sm text-white hover:bg-red-600 disabled:opacity-40"
            >
              {erasing ? 'Sletter…' : 'Slett fra minnekort'}
            </button>
          )}
        </div>
      )}

      {eraseResult && (
        <p className="text-sm text-gray-400">
          {eraseResult.deleted} filer slettet fra minnekortet
          {eraseResult.errors > 0 && ` · ${eraseResult.errors} feil ved sletting`}
        </p>
      )}

      {/* Handlinger */}
      {!isDone && (
        <div className="flex justify-end">
          {isRunning ? (
            <button
              type="button"
              className="rounded border border-gray-600 bg-gray-700 px-4 py-1.5 text-sm text-white hover:bg-gray-600"
              onClick={() => cancelCopyOperation(operation!.id)}
            >Avbryt</button>
          ) : (
            <button
              type="button"
              className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
              onClick={handleStart}
              disabled={!parentDir || !dirName || scanning || !!operation}
            >Kopier til lokal disk →</button>
          )}
        </div>
      )}
    </div>
  )
}
