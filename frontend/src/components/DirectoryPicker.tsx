/**
 * DirectoryPicker — modal for å velge en katalog som kilde.
 * Snarveier (pinnede kataloger) vises som pills øverst.
 * Pin-ikon dukker opp ved hover på katalogradene.
 */
import { useState } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { useQueryClient, useMutation } from '@tanstack/react-query'
import { useBrowse } from '../hooks/useBrowse'
import { deleteShortcut } from '../api/shortcuts'
import PinDirButton from './PinDirButton'

interface Props {
  initialPath?: string
  onSelect: (path: string) => void
  trigger: React.ReactNode
}

export default function DirectoryPicker({ initialPath, onSelect, trigger }: Props) {
  const [open, setOpen] = useState(false)
  const browse = useBrowse({ initialPath, enabled: open })

  const qc = useQueryClient()
  const delMut = useMutation({
    mutationFn: deleteShortcut,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['shortcuts'] }),
  })

  function handleOpenChange(next: boolean) {
    if (next) browse.reset()
    setOpen(next)
  }

  function handlePick() {
    if (browse.data) { onSelect(browse.data.path); setOpen(false) }
  }

  const isEmpty = browse.data && !browse.isLoading
    && browse.data.dirs.length === 0
    && browse.data.files.length === 0

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Trigger asChild>{trigger}</Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-40" />
        <Dialog.Content className="fixed inset-x-4 top-[8%] bottom-[8%] max-w-lg mx-auto z-50 bg-gray-900 rounded-xl border border-gray-700 flex flex-col outline-none">

          <div className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-gray-800">
            <button
              onClick={browse.navigateUp}
              disabled={!browse.data?.parent}
              className="shrink-0 px-2 py-1 rounded text-sm text-gray-400 hover:text-white hover:bg-gray-800 disabled:opacity-30"
            >
              ↑ Opp
            </button>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate" title={browse.path}>
                {browse.path ? (browse.path.split('/').filter(Boolean).pop() ?? browse.path) : '…'}
              </p>
              {browse.data?.parent && (
                <p className="text-xs text-gray-600 font-mono truncate" title={browse.data.parent}>
                  {browse.data.parent}
                </p>
              )}
            </div>
          </div>

          {(browse.shortcuts.length > 0 || browse.volumes.length > 0) && (
            <div className="shrink-0 flex gap-1.5 flex-wrap px-3 py-2 border-b border-gray-800">
              {browse.shortcuts.map(s => (
                <div key={s.id} className="group flex items-center gap-0.5">
                  <button
                    onClick={() => browse.setPath(s.path)}
                    title={s.path}
                    className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors
                      ${browse.path === s.path ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
                  >
                    {s.name}
                  </button>
                  {!s.is_default && (
                    <button
                      onClick={() => delMut.mutate(s.id)}
                      disabled={delMut.isPending}
                      title={`Fjern «${s.name}»`}
                      className="opacity-0 group-hover:opacity-100 text-gray-600 hover:text-red-400 text-xs px-0.5 transition-all"
                    >
                      ×
                    </button>
                  )}
                </div>
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
            {browse.data?.dirs.map(d => {
              const pinned = browse.shortcuts.find(s => s.path === d.path)
              return (
                <div key={d.path} onClick={() => browse.setPath(d.path)}
                  className="group cursor-pointer w-full px-3 py-2 rounded-lg text-sm text-white hover:bg-gray-800 flex items-center gap-3">
                  <span className="shrink-0 text-xs font-bold text-yellow-600 w-12">MAPPE</span>
                  <span className="truncate flex-1">{d.name}</span>
                  <PinDirButton path={d.path} name={d.name} shortcutId={pinned?.id} />
                </div>
              )
            })}
            {browse.data?.files.map(f => (
              <div key={f.path} className="px-3 py-1.5 flex items-center gap-3 text-sm text-gray-500">
                <span className="shrink-0 text-xs font-bold text-gray-700 w-12">{f.type}</span>
                <span className="truncate">{f.name}</span>
              </div>
            ))}
            {isEmpty && <p className="py-8 text-center text-sm text-gray-600">Tom katalog</p>}
          </div>

          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-600">
              {browse.data ? `${browse.data.dirs.length} mapper · ${browse.data.files.length} filer` : ''}
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
