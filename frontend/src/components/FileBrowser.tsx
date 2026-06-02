import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { browseDirectory, listVolumes } from '../api/system'
import { listShortcuts } from '../api/shortcuts'
import { makeDir } from '../api/fileops'

interface Props {
  initialPath?: string
  onSelect: (path: string) => void
  trigger: React.ReactNode
  allowNewFolder?: boolean
  newFolderParent?: string
  onFolderCreated?: (parentPath: string) => void
  directoriesOnly?: boolean      // skjul individuelle filer — kun mapper vises
}

export default function FileBrowser({ initialPath, onSelect, trigger, allowNewFolder = false, newFolderParent, onFolderCreated, directoriesOnly = false }: Props) {
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState('')
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const queryClient = useQueryClient()

  const { data: shortcuts = [] } = useQuery({
    queryKey: ['shortcuts'],
    queryFn: listShortcuts,
    enabled: open,
  })

  const { data: volumes = [] } = useQuery({
    queryKey: ['volumes'],
    queryFn: listVolumes,
    enabled: open,
    staleTime: 10_000,
  })

  function handleOpenChange(next: boolean) {
    if (next) {
      setPath(initialPath ?? '')
      setNewFolderName('')
      setShowNewFolder(false)
    }
    setOpen(next)
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim() || !data) return
    const parent = (newFolderParent ?? data.path).replace(/\/+$/, '')
    const newPath = parent + '/' + newFolderName.trim()
    setCreatingFolder(true)
    try {
      await makeDir(newPath)
      queryClient.invalidateQueries({ queryKey: ['browse', parent] })
      onFolderCreated?.(parent)
      onSelect(newPath)
      setOpen(false)
    } catch {
      // feil — ikke lukk dialogen
    } finally {
      setCreatingFolder(false)
      setNewFolderName('')
      setShowNewFolder(false)
    }
  }

  // Once shortcuts load: if path is still empty, jump to the first shortcut
  const resolvedPath = path === '' && shortcuts.length > 0 ? shortcuts[0].path : path

  const { data, isLoading } = useQuery({
    queryKey: ['browse', resolvedPath],
    queryFn: () => browseDirectory(resolvedPath),
    enabled: open,
  })

  function handlePick() {
    if (data) onSelect(data.path)
    setOpen(false)
  }

  const isEmpty = data && !isLoading && data.dirs.length === 0 && (directoriesOnly || data.files.length === 0)

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed inset-x-4 top-[8%] bottom-[8%] max-w-lg mx-auto z-50 bg-gray-900 rounded-xl border border-gray-700 flex flex-col outline-none">

          {/* Header */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-800">
            <button
              onClick={() => data?.parent != null && setPath(data.parent)}
              disabled={!data?.parent}
              className="shrink-0 px-2 py-1 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30 transition-colors"
            >
              ↑ Opp
            </button>
            <p className="flex-1 text-xs text-gray-500 font-mono truncate" title={data?.path}>{data?.path ?? '…'}</p>
          </div>

          {/* Snarveier og volumer */}
          {(shortcuts.length > 0 || volumes.length > 0) && (
            <div className="shrink-0 flex gap-1.5 flex-wrap px-3 py-2 border-b border-gray-800">
              {shortcuts.map(s => (
                <button
                  key={s.id}
                  onClick={() => setPath(s.path)}
                  title={s.path}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    data?.path === s.path
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'
                  }`}
                >
                  {s.name}
                </button>
              ))}
              {volumes.map(v => (
                <button
                  key={v.path}
                  onClick={() => setPath(v.path)}
                  title={v.path}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    data?.path === v.path
                      ? 'bg-orange-600 text-white'
                      : 'bg-gray-800 text-orange-300 hover:bg-gray-700 hover:text-orange-200'
                  }`}
                >
                  ⏏ {v.name}
                </button>
              ))}
            </div>
          )}

          {/* Liste */}
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {isLoading && <p className="py-8 text-center text-sm text-gray-600">Laster…</p>}

            {data?.dirs.map(d => (
              <button
                key={d.path}
                onClick={() => setPath(d.path)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-white hover:bg-gray-800 flex items-center gap-3 transition-colors"
              >
                <span className="shrink-0 text-xs font-bold text-yellow-600 w-12">MAPPE</span>
                <span className="truncate">{d.name}</span>
              </button>
            ))}

            {!directoriesOnly && data?.files.map(f => (
              <div key={f.path} className="px-3 py-1.5 flex items-center gap-3 text-sm text-gray-500">
                <span className="shrink-0 text-xs font-bold text-gray-700 w-12">{f.type}</span>
                <span className="truncate">{f.name}</span>
              </div>
            ))}

            {isEmpty && (
              <p className="py-8 text-center text-sm text-gray-600">Tom katalog</p>
            )}
          </div>

          {/* Ny mappe */}
          {allowNewFolder && (
            <div className="shrink-0 border-t border-gray-800 px-4 py-2">
              {showNewFolder ? (
                <div className="flex gap-2">
                  <input
                    autoFocus
                    type="text"
                    value={newFolderName}
                    onChange={e => setNewFolderName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false) }}
                    placeholder="Mappenavn…"
                    className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleCreateFolder}
                    disabled={!newFolderName.trim() || creatingFolder}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-40"
                  >
                    {creatingFolder ? '…' : 'Lag og velg'}
                  </button>
                  <button
                    onClick={() => setShowNewFolder(false)}
                    className="rounded px-2 py-1.5 text-sm text-gray-400 hover:text-white"
                  >
                    Avbryt
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowNewFolder(true)}
                  className="text-sm text-gray-400 hover:text-white"
                >
                  {newFolderParent ? `+ Ny mappe i ${newFolderParent.split('/').pop()}` : '+ Ny mappe her'}
                </button>
              )}
            </div>
          )}

          {/* Bunn */}
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-600">
              {data ? `${data.dirs.length} mappe${data.dirs.length !== 1 ? 'r' : ''}` : ''}
            </span>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <button className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                  Avbryt
                </button>
              </Dialog.Close>
              <button
                onClick={handlePick}
                disabled={!data}
                className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 transition-colors"
              >
                Velg denne katalogen
              </button>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
