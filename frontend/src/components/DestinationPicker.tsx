/**
 * DestinationPicker — modal for å velge en katalog som DESTINASJON for filflytting.
 * Viser kun mapper (ingen bildefiler). Ny mappe lages alltid under newFolderParent,
 * uavhengig av hva brukeren navigerer til i dialogen.
 *
 * Bruk: PhotoFolderGrid ("Flytt x bilder til…").
 *
 * Se docs/decisions/015-folder-browser-architecture.md for fremtidig plan (Alternativ C).
 */
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient } from '@tanstack/react-query'
import { useBrowse } from '../hooks/useBrowse'
import { makeDir } from '../api/fileops'

interface Props {
  initialPath?: string
  newFolderParent: string
  onSelect: (path: string) => void
  trigger: React.ReactNode
  onFolderCreated?: (parentPath: string) => void
}

export default function DestinationPicker({ initialPath, newFolderParent, onSelect, trigger, onFolderCreated }: Props) {
  const [open, setOpen] = useState(false)
  const [showNewFolder, setShowNewFolder] = useState(false)
  const [newFolderName, setNewFolderName] = useState('')
  const [creating, setCreating] = useState(false)
  const browse = useBrowse({ initialPath, enabled: open })
  const queryClient = useQueryClient()

  function handleOpenChange(next: boolean) {
    if (next) { browse.reset(); setShowNewFolder(false); setNewFolderName('') }
    setOpen(next)
  }

  function handlePick() {
    if (browse.data) { onSelect(browse.data.path); setOpen(false) }
  }

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return
    const parent = newFolderParent.replace(/\/+$/, '')
    const newPath = parent + '/' + newFolderName.trim()
    setCreating(true)
    try {
      await makeDir(newPath)
      queryClient.invalidateQueries({ queryKey: ['browse', parent] })
      onFolderCreated?.(parent)
      onSelect(newPath)
      setOpen(false)
    } catch {
      // hold dialogen åpen ved feil
    } finally {
      setCreating(false)
      setNewFolderName('')
      setShowNewFolder(false)
    }
  }

  const isEmpty = browse.data && !browse.isLoading && browse.data.dirs.length === 0
  const parentName = newFolderParent.split('/').filter(Boolean).pop() ?? newFolderParent

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed inset-x-4 top-[8%] bottom-[8%] max-w-lg mx-auto z-50 bg-gray-900 rounded-xl border border-gray-700 flex flex-col outline-none">

          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b border-gray-800">
            <button onClick={browse.navigateUp} disabled={!browse.data?.parent}
              className="shrink-0 px-2 py-1 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30">
              ↑ Opp
            </button>
            <p className="flex-1 text-xs text-gray-500 font-mono truncate" title={browse.path}>{browse.path || '…'}</p>
          </div>

          {(browse.shortcuts.length > 0 || browse.volumes.length > 0) && (
            <div className="shrink-0 flex gap-1.5 flex-wrap px-3 py-2 border-b border-gray-800">
              {browse.shortcuts.map(s => (
                <button key={s.id} onClick={() => browse.setPath(s.path)} title={s.path}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${browse.path === s.path ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'}`}>
                  {s.name}
                </button>
              ))}
              {browse.volumes.map(v => (
                <button key={v.path} onClick={() => browse.setPath(v.path)} title={v.path}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${browse.path === v.path ? 'bg-orange-600 text-white' : 'bg-gray-800 text-orange-300 hover:bg-gray-700 hover:text-orange-200'}`}>
                  ⏏ {v.name}
                </button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {browse.isLoading && <p className="py-8 text-center text-sm text-gray-600">Laster…</p>}
            {browse.data?.dirs.map(d => (
              <button key={d.path} onClick={() => browse.setPath(d.path)}
                className="w-full text-left px-3 py-2 rounded-lg text-sm text-white hover:bg-gray-800 flex items-center gap-3">
                <span className="shrink-0 text-xs font-bold text-yellow-600 w-12">MAPPE</span>
                <span className="truncate">{d.name}</span>
              </button>
            ))}
            {isEmpty && <p className="py-8 text-center text-sm text-gray-600">Ingen undermapper</p>}
          </div>

          {/* Ny mappe — alltid under newFolderParent */}
          <div className="shrink-0 border-t border-gray-800 px-4 py-2">
            {showNewFolder ? (
              <div className="flex gap-2">
                <input autoFocus type="text" value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setShowNewFolder(false) }}
                  placeholder="Mappenavn…"
                  className="flex-1 rounded border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500"
                />
                <button onClick={handleCreateFolder} disabled={!newFolderName.trim() || creating}
                  className="rounded bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-500 disabled:opacity-40">
                  {creating ? '…' : 'Lag og velg'}
                </button>
                <button onClick={() => setShowNewFolder(false)} className="rounded px-2 py-1.5 text-sm text-gray-400 hover:text-white">Avbryt</button>
              </div>
            ) : (
              <button onClick={() => setShowNewFolder(true)} className="text-sm text-gray-400 hover:text-white">
                + Ny mappe i {parentName}
              </button>
            )}
          </div>

          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-600">
              {browse.data ? `${browse.data.dirs.length} mapper` : ''}
            </span>
            <div className="flex gap-2">
              <Dialog.Close asChild>
                <button className="px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800">Avbryt</button>
              </Dialog.Close>
              <button onClick={handlePick} disabled={!browse.data}
                className="px-4 py-2 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
                Velg denne katalogen
              </button>
            </div>
          </div>

        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
