import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import * as Dialog from '@radix-ui/react-dialog'
import { browseDirectory } from '../api/system'

interface Props {
  initialPath?: string
  onSelect: (path: string) => void
  trigger: React.ReactNode
  imagesOnly?: boolean
}

export default function FileBrowser({ initialPath, onSelect, trigger, imagesOnly = true }: Props) {
  const [open, setOpen] = useState(false)
  const [path, setPath] = useState('')

  function handleOpenChange(next: boolean) {
    if (next) setPath(initialPath ?? '')
    setOpen(next)
  }

  const { data, isLoading } = useQuery({
    queryKey: ['browse', path, imagesOnly],
    queryFn: () => browseDirectory(path, imagesOnly),
    enabled: open,
  })

  function handlePick() {
    if (data) onSelect(data.path)
    setOpen(false)
  }

  const isEmpty = data && !isLoading && data.dirs.length === 0 && data.files.length === 0

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

            {data?.files.map(f => (
              <div key={f.path} className="px-3 py-1.5 flex items-center gap-3 text-sm text-gray-500">
                <span className="shrink-0 text-xs font-bold text-gray-700 w-12">{f.type}</span>
                <span className="truncate">{f.name}</span>
              </div>
            ))}

            {isEmpty && (
              <p className="py-8 text-center text-sm text-gray-600">
                {imagesOnly ? 'Ingen bildefiler funnet' : 'Tom katalog'}
              </p>
            )}
          </div>

          {/* Bunn */}
          <div className="shrink-0 flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-800">
            <span className="text-xs text-gray-600">
              {data && imagesOnly
                ? `${data.files.length} bildefil${data.files.length !== 1 ? 'er' : ''} her`
                : data
                  ? `${data.dirs.length} mappe${data.dirs.length !== 1 ? 'r' : ''}`
                  : ''}
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
