import { useEffect, useRef, useState } from 'react'
import { suggestName, startCopy, getCopyOperation, cancelCopyOperation, getCopySkips } from '../../api/fileCopy'
import type { FileCopyOperation, FileCopySkip } from '../../types/api'

interface Props {
  onCopyCompleted: (destinationPath: string, operationId: string) => void
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

export default function CopySection({ onCopyCompleted }: Props) {
  const [sourcePath, setSourcePath] = useState('')
  const [parentDir, setParentDir] = useState('')
  const [dirName, setDirName] = useState('')
  const [suggestion, setSuggestion] = useState<string | null>(null)
  const [filesFound, setFilesFound] = useState<number | null>(null)
  const [bytesTotal, setBytesTotal] = useState<number | null>(null)
  const [deviceLabel, setDeviceLabel] = useState('')
  const [operation, setOperation] = useState<FileCopyOperation | null>(null)
  const [skips, setSkips] = useState<FileCopySkip[]>([])
  const [showSkips, setShowSkips] = useState(false)
  const [scanning, setScanning] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Fetch suggestion when source is set
  useEffect(() => {
    if (!sourcePath) return
    setScanning(true)
    setSuggestion(null)
    setFilesFound(null)
    suggestName(sourcePath)
      .then(r => {
        setSuggestion(r.suggested_name)
        setFilesFound(r.files_found)
        setBytesTotal(r.bytes_total)
      })
      .catch(() => {})
      .finally(() => setScanning(false))
  }, [sourcePath])

  // Poll during copy
  useEffect(() => {
    if (!operation) return
    if (['completed', 'failed', 'cancelled'].includes(operation.status)) return

    pollRef.current = setInterval(async () => {
      const updated = await getCopyOperation(operation.id)
      setOperation(updated)
      if (['completed', 'failed', 'cancelled'].includes(updated.status)) {
        clearInterval(pollRef.current!)
        if (updated.status === 'completed') {
          onCopyCompleted(updated.destination_path, updated.id)
          if (updated.files_skipped > 0) {
            const s = await getCopySkips(updated.id)
            setSkips(s)
          }
        }
      }
    }, 800)

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [operation?.id, operation?.status])

  async function pickDirectory(setter: (p: string) => void) {
    const r = await fetch('/system/pick-directory', { method: 'POST' }).then(r => r.json())
    if (r.path) setter(r.path)
  }

  function handleNameKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Tab' && suggestion && dirName === '') {
      e.preventDefault()
      setDirName(suggestion)
      setTimeout(() => {
        const el = nameInputRef.current
        if (el) { el.selectionStart = el.selectionEnd = el.value.length }
      }, 0)
    }
  }

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

  async function handleCancel() {
    if (!operation) return
    await cancelCopyOperation(operation.id)
  }

  const destPath = parentDir && dirName ? parentDir.replace(/\/+$/, '') + '/' + dirName : ''
  const isRunning = operation && ['pending', 'running'].includes(operation.status)
  const isDone = operation?.status === 'completed'
  const progress = operation && operation.bytes_total > 0
    ? operation.bytes_copied / operation.bytes_total
    : 0

  return (
    <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-3">

      {/* Source */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Kilde</label>
        <div className="flex gap-2">
          <input
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm font-mono"
            value={sourcePath}
            onChange={e => setSourcePath(e.target.value)}
            placeholder="/Volumes/EOS_DIGITAL/DCIM"
            disabled={!!operation}
          />
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            onClick={() => pickDirectory(setSourcePath)}
            disabled={!!operation}
          >Velg…</button>
        </div>
        {scanning && <p className="mt-1 text-xs text-gray-500">Skanner kilde…</p>}
        {filesFound !== null && !scanning && (
          <p className="mt-1 text-xs text-gray-600">
            {filesFound} filer · {formatBytes(bytesTotal ?? 0)}
          </p>
        )}
      </div>

      {/* Destination */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Destinasjon</label>
        <div className="flex gap-2 mb-1">
          <input
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm font-mono"
            value={parentDir}
            onChange={e => setParentDir(e.target.value)}
            placeholder="/bilder"
            disabled={!!operation}
          />
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40"
            onClick={() => pickDirectory(setParentDir)}
            disabled={!!operation}
          >Velg…</button>
        </div>
        <div className="flex gap-2 items-center">
          <span className="text-sm text-gray-400 select-none">/</span>
          <input
            ref={nameInputRef}
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-sm font-mono"
            value={dirName}
            onChange={e => setDirName(e.target.value)}
            onKeyDown={handleNameKeyDown}
            placeholder={suggestion ?? 'katalognavn'}
            disabled={!!operation}
          />
        </div>
        {suggestion && dirName === '' && (
          <p className="mt-1 text-xs text-gray-500">
            Trykk <kbd className="rounded border border-gray-300 bg-white px-1 text-xs">Tab</kbd> for å bruke forslaget «{suggestion}»
          </p>
        )}
        {destPath && (
          <p className="mt-1 text-xs text-gray-500 font-mono truncate">→ {destPath}</p>
        )}
      </div>

      {/* Device label */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Enhetsnavn <span className="font-normal text-gray-400">(valgfritt)</span>
        </label>
        <input
          className="w-full rounded border border-gray-300 px-3 py-1.5 text-sm"
          value={deviceLabel}
          onChange={e => setDeviceLabel(e.target.value)}
          placeholder="Sony A7IV kort 1"
          disabled={!!operation}
        />
      </div>

      {/* Progress */}
      {operation && (
        <div className="space-y-2">
          <div className="h-2 w-full rounded-full bg-gray-200">
            <div
              className="h-2 rounded-full bg-blue-500 transition-all"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {operation.files_copied} av {operation.files_total} filer
            {' · '}{formatBytes(operation.bytes_copied)} av {formatBytes(operation.bytes_total)}
          </p>
          {operation.status === 'failed' && (
            <p className="text-sm text-red-600">{operation.error}</p>
          )}
          {isDone && (
            <p className="text-sm text-green-700">
              ✓ {operation.files_copied} filer kopiert
              {operation.files_skipped > 0 && ` · ${operation.files_skipped} hoppet over`}
            </p>
          )}
        </div>
      )}

      {/* Skips */}
      {skips.length > 0 && (
        <div>
          <button
            type="button"
            className="text-sm text-blue-600 underline"
            onClick={() => setShowSkips(v => !v)}
          >
            {showSkips ? 'Skjul' : 'Vis'} hoppede over ({skips.length})
          </button>
          {showSkips && (
            <ul className="mt-2 max-h-32 overflow-y-auto rounded border border-gray-200 bg-white text-xs divide-y">
              {skips.map(s => (
                <li key={s.id} className="px-2 py-1 flex gap-2">
                  <span className="text-gray-400 shrink-0">{s.reason}</span>
                  <span className="font-mono truncate">{s.source_path}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        {isRunning && (
          <button
            type="button"
            className="rounded border border-gray-300 bg-white px-4 py-1.5 text-sm hover:bg-gray-50"
            onClick={handleCancel}
          >Avbryt</button>
        )}
        {!operation && (
          <button
            type="button"
            className="rounded bg-blue-600 px-4 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-40"
            onClick={handleStart}
            disabled={!sourcePath || !parentDir || !dirName || scanning}
          >Kopier filer →</button>
        )}
        {isDone && (
          <button
            type="button"
            className="rounded bg-green-600 px-4 py-1.5 text-sm text-white hover:bg-green-700"
            onClick={() => onCopyCompleted(operation!.destination_path, operation!.id)}
          >Fortsett til skanning →</button>
        )}
      </div>
    </div>
  )
}
