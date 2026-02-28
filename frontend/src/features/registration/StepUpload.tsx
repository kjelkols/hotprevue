import { useEffect, useRef, useState } from 'react'
import { uploadGroupByPath, completeSession } from '../../api/inputSessions'
import type { FileGroup, ProcessResult } from '../../types/api'

interface Props {
  sessionId: string
  unknownGroups: FileGroup[]
  onDone: (result: ProcessResult) => void
}

interface Progress {
  done: number
  total: number
  registered: number
  duplicates: number
  errors: number
}

export default function StepUpload({ sessionId, unknownGroups, onDone }: Props) {
  const [progress, setProgress] = useState<Progress>({
    done: 0,
    total: unknownGroups.length,
    registered: 0,
    duplicates: 0,
    errors: 0
  })
  const [currentFile, setCurrentFile] = useState('')
  const [failed, setFailed] = useState(false)
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true
    runUpload()
  }, [])

  async function runUpload() {
    for (const group of unknownGroups) {
      setCurrentFile(group.master_path.split(/[\\/]/).pop() ?? group.master_path)
      try {
        const result = await uploadGroupByPath(
          sessionId,
          group.master_path,
          group.master_type,
          group.companions
        )
        setProgress(p => ({
          ...p,
          done: p.done + 1,
          registered: p.registered + (result.status === 'registered' ? 1 : 0),
          duplicates: p.duplicates + (result.status === 'duplicate' || result.status === 'already_registered' ? 1 : 0)
        }))
      } catch {
        setProgress(p => ({ ...p, done: p.done + 1, errors: p.errors + 1 }))
      }
    }

    try {
      const final = await completeSession(sessionId)
      onDone(final)
    } catch {
      setFailed(true)
    }
  }

  const percent = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div className="rounded-xl border border-gray-700 bg-gray-900 p-6">
        <h2 className="mb-1 text-lg font-semibold text-white">Laster opp…</h2>
        <p className="mb-4 truncate text-sm text-gray-500">{currentFile || 'Starter…'}</p>

        <div className="mb-2 h-3 overflow-hidden rounded-full bg-gray-800">
          <div
            className="h-full rounded-full bg-blue-600 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>
        <p className="mb-4 text-right text-sm text-gray-400">
          {progress.done} / {progress.total} ({percent}%)
        </p>

        <div className="grid grid-cols-3 gap-3">
          <MiniStat label="Registrert" value={progress.registered} color="text-green-400" />
          <MiniStat label="Duplikater" value={progress.duplicates} color="text-yellow-400" />
          <MiniStat label="Feil" value={progress.errors} color="text-red-400" />
        </div>
      </div>

      {failed && (
        <p className="rounded-xl border border-red-800 bg-red-950 px-4 py-3 text-sm text-red-300">
          Klarte ikke å fullføre sesjonen. Sjekk backend-tilkoblingen.
        </p>
      )}
    </div>
  )
}

function MiniStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-gray-800 px-3 py-2 text-center">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-xl font-bold ${color}`}>{value}</p>
    </div>
  )
}
