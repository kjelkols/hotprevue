import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { startPrescan, getPrescanStatus, getPrescanFiles } from '../../api/prescan'
import { moveGroup, makeDir } from '../../api/fileops'
import usePreorganiserStore from '../../stores/usePreorganiserStore'
import FileGroupTile from './FileGroupTile'
import DateGroupHeader from './DateGroupHeader'
import PrescanStatusBar from './PrescanStatusBar'
import TimeRangePicker from './TimeRangePicker'
import PreviewLightbox from './PreviewLightbox'
import FileBrowser from '../../components/FileBrowser'
import type { PrescanFileEntry, PrescanJobStatus } from '../../types/api'

interface DateGroup {
  date: string
  label: string
  files: PrescanFileEntry[]
}

export default function PhotoFolderGrid() {
  const currentDir = usePreorganiserStore(s => s.currentDir)
  const selected = usePreorganiserStore(s => s.selected)
  const clear = usePreorganiserStore(s => s.clear)
  const selectAll = usePreorganiserStore(s => s.selectAll)
  const dateGrouping = usePreorganiserStore(s => s.dateGrouping)
  const toggleDateGrouping = usePreorganiserStore(s => s.toggleDateGrouping)

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [scanJob, setScanJob] = useState<PrescanJobStatus | null>(null)
  const [showTimeRange, setShowTimeRange] = useState(false)
  const [moving, setMoving] = useState(false)
  const [moveError, setMoveError] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const queryClient = useQueryClient()

  const { data: files = [], refetch: refetchFiles } = useQuery({
    queryKey: ['prescan-files', currentDir],
    queryFn: () => getPrescanFiles(currentDir),
    enabled: !!currentDir,
    staleTime: 0,
    // Poller til alle filer har preview — garantert oppdatering uavhengig av prescan-job
    refetchInterval: (query) => {
      const data = query.state.data
      if (!data || data.length === 0) return 1500
      if (data.some(f => f.hotpreview_b64 === null)) return 1500
      return false
    },
  })

  const sortedFiles = [...files].sort((a, b) => {
    if (!a.taken_at && !b.taken_at) return 0
    if (!a.taken_at) return 1
    if (!b.taken_at) return -1
    return a.taken_at.localeCompare(b.taken_at)
  })

  function handleSelectSameDate(file: PrescanFileEntry) {
    if (!file.taken_at) return
    const day = file.taken_at.slice(0, 10)
    selectAll(files.filter(f => f.taken_at?.slice(0, 10) === day).map(f => f.file_path))
  }

  const dateGroups: DateGroup[] = (() => {
    const map = new Map<string, PrescanFileEntry[]>()
    for (const f of sortedFiles) {
      const key = f.taken_at?.slice(0, 10) ?? 'ukjent'
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(f)
    }
    return Array.from(map.entries()).map(([date, groupFiles]) => ({
      date,
      label: date === 'ukjent'
        ? 'Ukjent dato'
        : new Date(date).toLocaleDateString('nb-NO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }),
      files: groupFiles,
    }))
  })()

  // Start prescan og poll til ferdig
  useEffect(() => {
    if (!currentDir) return
    setScanJob(null)
    clear()

    startPrescan(currentDir).then(job => {
      setScanJob(job)
      pollRef.current = setInterval(async () => {
        const updated = await getPrescanStatus(job.id)
        setScanJob(updated)
        // Oppdater thumbnails underveis
        queryClient.invalidateQueries({ queryKey: ['prescan-files', currentDir] })
        if (['completed', 'failed', 'cancelled'].includes(updated.status)) {
          clearInterval(pollRef.current!)
        }
      }, 1500)
    }).catch(() => {/* agenten ikke tilgjengelig */})

    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [currentDir])

  async function handleMoveSelected(destDir: string) {
    setMoving(true)
    setMoveError('')
    const paths = Array.from(selected)
    let failed = 0
    for (const path of paths) {
      try {
        await moveGroup(path, destDir)
      } catch {
        failed++
      }
    }
    setMoving(false)
    clear()
    refetchFiles()
    if (failed > 0) setMoveError(`${failed} filer kunne ikke flyttes`)
  }

  function handleDeleted(path: string) {
    const nextIndex = lightboxIndex !== null && lightboxIndex >= sortedFiles.length - 1
      ? Math.max(0, lightboxIndex - 1)
      : lightboxIndex
    setLightboxIndex(sortedFiles.length <= 1 ? null : nextIndex)
    refetchFiles()
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim() || !currentDir) return
    const path = currentDir.replace(/\/+$/, '') + '/' + newFolderName.trim()
    try {
      await makeDir(path)
      setNewFolderName('')
      setShowNewFolder(false)
      queryClient.invalidateQueries({ queryKey: ['browse', currentDir] })
    } catch {
      setMoveError('Kunne ikke lage katalog')
    }
  }

  if (!currentDir) {
    return (
      <div className="flex flex-1 items-center justify-center text-gray-600">
        Velg en katalog i venstre panel
      </div>
    )
  }

  const selectedCount = selected.size
  const orderedPaths = sortedFiles.map(f => f.file_path)

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Verktøylinje */}
      <div className="flex flex-wrap items-center gap-2 border-b border-gray-800 px-4 py-2">
        <span className="text-sm text-gray-400">
          {files.length} bilder
          {selectedCount > 0 && <span className="ml-2 text-blue-400">{selectedCount} valgt</span>}
        </span>

        <div className="ml-auto flex flex-wrap gap-2">
          {selectedCount > 0 && (
            <>
              <button
                onClick={clear}
                className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800"
              >
                Avbryt valg
              </button>
              <FileBrowser
                onSelect={handleMoveSelected}
                initialPath={currentDir}
                allowNewFolder
                onFolderCreated={parentPath => queryClient.invalidateQueries({ queryKey: ['browse', parentPath] })}
                trigger={
                  <button
                    disabled={moving}
                    className="rounded bg-blue-600 px-3 py-1 text-sm text-white hover:bg-blue-500 disabled:opacity-50"
                  >
                    {moving ? 'Flytter…' : `Flytt ${selectedCount} bilde${selectedCount !== 1 ? 'r' : ''} til…`}
                  </button>
                }
              />
            </>
          )}

          <button
            onClick={() => selectAll(orderedPaths)}
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800"
          >
            Velg alle
          </button>

          <button
            onClick={() => setShowTimeRange(v => !v)}
            className={[
              'rounded px-2 py-1 text-xs hover:bg-gray-800',
              showTimeRange ? 'text-white' : 'text-gray-400',
            ].join(' ')}
          >
            Velg tidsrom
          </button>

          <button
            onClick={toggleDateGrouping}
            className={[
              'rounded px-2 py-1 text-xs hover:bg-gray-800',
              dateGrouping ? 'text-white' : 'text-gray-400',
            ].join(' ')}
            title="Gruppér på dato"
          >
            Datogrupper
          </button>

          <button
            onClick={() => setShowNewFolder(v => !v)}
            className="rounded px-2 py-1 text-xs text-gray-400 hover:bg-gray-800"
          >
            + Ny mappe
          </button>
        </div>
      </div>

      {/* Tidsromvelger */}
      {showTimeRange && (
        <div className="border-b border-gray-800 px-4 py-3">
          <TimeRangePicker files={files} />
        </div>
      )}

      {/* Ny mappe */}
      {showNewFolder && (
        <div className="flex gap-2 border-b border-gray-800 px-4 py-2">
          <input
            type="text"
            value={newFolderName}
            onChange={e => setNewFolderName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder() }}
            placeholder="Katalognavn…"
            autoFocus
            className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
          />
          <button
            onClick={handleCreateFolder}
            disabled={!newFolderName.trim()}
            className="rounded bg-gray-700 px-3 py-1.5 text-sm text-white hover:bg-gray-600 disabled:opacity-40"
          >
            Lag
          </button>
        </div>
      )}

      {/* Feilmelding */}
      {moveError && (
        <div className="border-b border-red-900 bg-red-950 px-4 py-2 text-sm text-red-300">
          {moveError}
          <button onClick={() => setMoveError('')} className="ml-3 text-xs underline">Lukk</button>
        </div>
      )}

      {/* Grid — klikk på tom bakgrunn fjerner valg */}
      <div
        className="flex-1 overflow-y-auto p-4"
        onClick={e => { if (e.target === e.currentTarget) clear() }}
      >
        {files.length === 0 && scanJob?.status === 'completed' ? (
          <p className="text-gray-600">Ingen bilder i denne katalogen</p>
        ) : dateGrouping ? (
          <div onClick={e => { if (e.target === e.currentTarget) clear() }}>
            {dateGroups.map(group => (
              <div key={group.date}>
                <DateGroupHeader
                  date={group.date}
                  label={group.label}
                  files={group.files}
                  allFiles={sortedFiles}
                />
                <div className="flex flex-wrap gap-1 pb-2">
                  {group.files.map(f => {
                    const i = orderedPaths.indexOf(f.file_path)
                    return (
                      <FileGroupTile
                        key={f.file_path}
                        file={f}
                        orderedPaths={orderedPaths}
                        onSelectSameDate={() => handleSelectSameDate(f)}
                        onDoubleClick={() => setLightboxIndex(i)}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div
            className="flex flex-wrap gap-1"
            onClick={e => { if (e.target === e.currentTarget) clear() }}
          >
            {sortedFiles.map((f, i) => (
              <FileGroupTile
                key={f.file_path}
                file={f}
                orderedPaths={orderedPaths}
                onSelectSameDate={() => handleSelectSameDate(f)}
                onDoubleClick={() => setLightboxIndex(i)}
              />
            ))}
          </div>
        )}
      </div>

      <PrescanStatusBar job={scanJob} />

      {lightboxIndex !== null && (
        <PreviewLightbox
          files={sortedFiles}
          index={lightboxIndex}
          onNavigate={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  )
}
