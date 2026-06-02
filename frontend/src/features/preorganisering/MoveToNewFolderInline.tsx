import { useState } from 'react'
import { makeDir } from '../../api/fileops'
import { moveGroup } from '../../api/fileops'
import type { PrescanFileEntry } from '../../types/api'

interface Props {
  files: PrescanFileEntry[]
  suggestedDate?: string   // YYYY-MM-DD fra klikket datogruppe
  currentDir: string
  onMoved: () => void
  onCancel: () => void
}

function suggestName(date: string | undefined, files: PrescanFileEntry[]): string {
  const src = date ?? files.map(f => f.taken_at?.slice(0, 10)).filter(Boolean).sort()[0]
  return src && src !== 'ukjent' ? src.replace(/-/g, '_') : 'ny-mappe'
}

export default function MoveToNewFolderInline({ files, suggestedDate, currentDir, onMoved, onCancel }: Props) {
  const [name, setName] = useState(() => suggestName(suggestedDate, files))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const destPath = currentDir.replace(/\/+$/, '') + '/' + name.trim()
  const companionCount = files.reduce((n, f) => n + f.companions.length, 0)
  const totalFiles = files.length + companionCount

  async function handleMove() {
    if (!name.trim()) return
    setBusy(true)
    setError('')
    try {
      await makeDir(destPath)
      for (const f of files) {
        await moveGroup(f.file_path, destPath)
      }
      onMoved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Noe gikk galt')
      setBusy(false)
    }
  }

  return (
    <div className="mx-1 mb-2 rounded-lg border border-blue-900/50 bg-blue-950/20 p-3 space-y-2">
      <div className="flex gap-2">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleMove(); if (e.key === 'Escape') onCancel() }}
          className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white font-mono outline-none focus:border-blue-500"
          placeholder="mappenavn"
        />
        <button
          onClick={handleMove}
          disabled={busy || !name.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-40"
        >
          {busy ? 'Flytter…' : 'Lag og flytt →'}
        </button>
        <button
          onClick={onCancel}
          className="rounded px-2 py-1.5 text-sm text-gray-400 hover:text-white"
        >
          Avbryt
        </button>
      </div>

      <div className="flex items-center gap-3 text-xs text-gray-500">
        <span className="font-mono truncate">{destPath}/</span>
        <span className="shrink-0">{files.length} bilde{files.length !== 1 ? 'r' : ''}{companionCount > 0 ? ` + ${companionCount} companions` : ''} · {totalFiles} filer totalt</span>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
