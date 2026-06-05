import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { browseDirectory, listVolumes } from '../../api/system'
import usePreorganiserStore from '../../stores/usePreorganiserStore'
import { usePinnedFolders } from './usePinnedFolders'
import CardImportPanel from './CardImportPanel'
import type { BrowseDir } from '../../types/api'

export default function FolderPanel() {
  const currentDir = usePreorganiserStore(s => s.currentDir)
  const setCurrentDir = usePreorganiserStore(s => s.setCurrentDir)
  const [cardSource, setCardSource] = useState<string | null>(null)
  const { pinned, pin, unpin, isPinned } = usePinnedFolders()

  const { data: volumes = [] } = useQuery({
    queryKey: ['volumes'],
    queryFn: listVolumes,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const { data: browse } = useQuery({
    queryKey: ['browse', currentDir],
    queryFn: () => browseDirectory(currentDir),
    staleTime: 5_000,
  })

  const volumePaths = new Set(volumes.map((v: BrowseDir) => v.path))

  return (
    <aside className="flex h-full w-full flex-col border-r border-gray-800 bg-gray-950 overflow-y-auto">

      {/* Festede mapper */}
      {pinned.length > 0 && (
        <section className="border-b border-gray-800 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Festet</p>
          {pinned.map(p => (
            <div key={p.path} className="group flex items-center gap-1">
              <button
                onClick={() => setCurrentDir(p.path)}
                className={[
                  'flex flex-1 items-center gap-2 rounded px-2 py-1.5 text-left text-sm truncate',
                  currentDir === p.path ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-800',
                ].join(' ')}
                title={p.path}
              >
                <span className="text-gray-500 shrink-0">📁</span>
                <span className="truncate">{p.name}</span>
              </button>
              <button
                onClick={() => unpin(p.path)}
                className="hidden shrink-0 rounded p-0.5 text-gray-600 hover:text-gray-300 group-hover:block"
                title="Fjern"
              >
                ×
              </button>
            </div>
          ))}
        </section>
      )}

      {/* Minnekort */}
      {volumes.length > 0 && (
        <section className="border-b border-gray-800 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">Minnekort</p>
          {volumes.map((v: BrowseDir) => (
            <button
              key={v.path}
              onClick={() => setCardSource(v.path)}
              className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm text-orange-300 hover:bg-gray-800"
            >
              <span>💾</span>
              <span className="truncate">{v.name}</span>
            </button>
          ))}
        </section>
      )}

      {/* Navigasjon */}
      <section className="flex-1 p-3">
        {browse && (
          <>
            {/* Opp-knapp */}
            {browse.parent && (
              <button
                onClick={() => setCurrentDir(browse.parent!)}
                className="mb-1 flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-gray-500 hover:bg-gray-800 hover:text-white"
              >
                ↑ Opp
              </button>
            )}

            {/* Gjeldende mappe med pin-knapp */}
            {currentDir && (
              <div className="group mb-2 flex items-center gap-1 px-2">
                <span
                  className="flex-1 truncate text-xs font-medium text-gray-400 font-mono"
                  title={currentDir}
                >
                  {currentDir.split('/').filter(Boolean).pop() || currentDir}
                </span>
                <button
                  onClick={() => isPinned(currentDir) ? unpin(currentDir) : pin(currentDir)}
                  className={[
                    'shrink-0 rounded px-1 py-0.5 text-xs transition-colors',
                    isPinned(currentDir)
                      ? 'text-blue-400 hover:text-gray-400'
                      : 'text-gray-600 hover:text-gray-300 opacity-0 group-hover:opacity-100',
                  ].join(' ')}
                  title={isPinned(currentDir) ? 'Fjern festing' : 'Fest denne mappen'}
                >
                  📌
                </button>
              </div>
            )}

            {/* Undermapper */}
            {!currentDir && (
              <p className="px-2 text-xs text-gray-600">Velg en katalog for å begynne</p>
            )}
            {browse.dirs.map(d => {
              const isCard = volumePaths.has(d.path)
              return (
                <button
                  key={d.path}
                  onClick={() => isCard ? setCardSource(d.path) : setCurrentDir(d.path)}
                  className={[
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm truncate',
                    currentDir === d.path
                      ? 'bg-gray-700 text-white'
                      : isCard
                      ? 'text-orange-300 hover:bg-gray-800'
                      : 'text-gray-300 hover:bg-gray-800',
                  ].join(' ')}
                >
                  <span className="text-gray-500 shrink-0">📁</span>
                  <span className="truncate">{d.name}</span>
                </button>
              )
            })}
          </>
        )}
      </section>

      {cardSource && (
        <CardImportPanel
          sourcePath={cardSource}
          onClose={() => setCardSource(null)}
        />
      )}
    </aside>
  )
}
