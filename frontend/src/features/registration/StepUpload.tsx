import { useEffect, useRef, useState } from 'react'
import { registerGroup, completeSession, createSession } from '../../api/inputSessions'
import { createEvent } from '../../api/events'
import { processFile } from '../../api/agent'
import type { FileGroup, ProcessResult } from '../../types/api'
import type { FolderMapping, ResolvedEntry } from './registrationTypes'

interface Props {
  unknownGroups: FileGroup[]
  folderMappings: FolderMapping[]
  sessionName: string
  photographerId: string
  dirPath: string
  recursive: boolean
  onDone: (result: ProcessResult) => void
}

interface Progress {
  done: number
  total: number
  registered: number
  duplicates: number
  errors: number
}

function resolveEventId(masterPath: string, entries: ResolvedEntry[]): string | null {
  let best: ResolvedEntry | null = null
  for (const entry of entries) {
    if (masterPath.startsWith(entry.folderPath + '/') || masterPath.startsWith(entry.folderPath)) {
      if (!best || entry.folderPath.length > best.folderPath.length) best = entry
    }
  }
  return best?.eventId ?? null
}

export default function StepUpload({ unknownGroups, folderMappings, sessionName, photographerId, dirPath, recursive, onDone }: Props) {
  const [progress, setProgress] = useState<Progress>({
    done: 0, total: unknownGroups.length, registered: 0, duplicates: 0, errors: 0,
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
    // Create events and session before starting the upload loop
    const resolvedEntries: ResolvedEntry[] = []
    let sessionId: string
    try {
      for (const mapping of folderMappings) {
        let eventId: string | null = null
        if (mapping.existingEventId) {
          eventId = mapping.existingEventId
        } else if (mapping.eventName) {
          const event = await createEvent({ name: mapping.eventName })
          eventId = event.id
        }
        resolvedEntries.push({ folderPath: mapping.folderPath, eventId })
      }
      const session = await createSession({
        name: sessionName,
        source_path: dirPath,
        default_photographer_id: photographerId,
        default_event_id: null,
        recursive,
        notes: null,
      })
      sessionId = session.id
    } catch {
      setFailed(true)
      return
    }

    for (const group of unknownGroups) {
      setCurrentFile(group.master_path.split(/[\\/]/).pop() ?? group.master_path)
      try {
        const processed = await processFile(group.master_path, group.companions.map(c => c.path))
        const result = await registerGroup(sessionId, {
          hothash: processed.hothash,
          hotpreview_b64: processed.hotpreview_b64,
          coldpreview_b64: processed.coldpreview_b64,
          master_path: group.master_path,
          master_type: group.master_type,
          master_exif: processed.exif,
          width: processed.width,
          height: processed.height,
          taken_at: processed.taken_at,
          location_lat: processed.gps_lat,
          location_lng: processed.gps_lng,
          camera_make: processed.camera_fields.camera_make as string ?? null,
          camera_model: processed.camera_fields.camera_model as string ?? null,
          lens_model: processed.camera_fields.lens_model as string ?? null,
          iso: processed.camera_fields.iso as number ?? null,
          shutter_speed: processed.camera_fields.shutter_speed as string ?? null,
          aperture: processed.camera_fields.aperture as number ?? null,
          focal_length: processed.camera_fields.focal_length as number ?? null,
          sharpness_score: processed.sharpness_score,
          exposure_mean: processed.exposure_mean,
          exposure_clipping: processed.exposure_clipping,
          noise_score: processed.noise_score,
          companions: group.companions,
          event_id: resolveEventId(group.master_path, resolvedEntries),
        })
        setProgress(p => ({
          ...p,
          done: p.done + 1,
          registered: p.registered + (result.status === 'registered' ? 1 : 0),
          duplicates: p.duplicates + (result.status === 'duplicate' ? 1 : 0),
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
