import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { browseDirectory, listVolumes } from '../../api/system'
import usePreorganiserStore from '../../stores/usePreorganiserStore'
import CardImportPanel from './CardImportPanel'
import type { BrowseDir } from '../../types/api'

export default function FolderPanel() {
  const currentDir = usePreorganiserStore(s => s.currentDir)
  const setCurrentDir = usePreorganiserStore(s => s.setCurrentDir)
  const [cardSource, setCardSource] = useState<string | null>(null)

  const { data: volumes = [] } = useQuery({
    queryKey: ['volumes'],
    queryFn: listVolumes,
    staleTime: 15_000,
    refetchInterval: 30_000,
  })

  const { data: browse } = useQuery({
    queryKey: ['browse', currentDir],
    queryFn: () => browseDirectory(currentDir),
    enabled: true,
    staleTime: 5_000,
  })

  const volumePaths = new Set(volumes.map((v: BrowseDir) => v.path))

  function navigateTo(path: string) {
    setCurrentDir(path)
  }

  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-gray-800 bg-gray-950 overflow-y-auto">
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
                onClick={() => navigateTo(browse.parent!)}
                className="mb-1 flex w-full items-center gap-1 rounded px-2 py-1 text-left text-xs text-gray-500 hover:bg-gray-800 hover:text-white"
              >
                ↑ Opp
              </button>
            )}

            {/* Gjeldende sti */}
            {currentDir && (
              <div className="mb-2 truncate px-2 text-xs text-gray-500 font-mono" title={currentDir}>
                {currentDir.split(/[\\/]/).pop() || currentDir}
              </div>
            )}

            {/* Undermapper */}
            {browse.dirs.length === 0 && !currentDir && (
              <p className="px-2 text-xs text-gray-600">Velg en katalog for å begynne</p>
            )}
            {browse.dirs.map(d => {
              const isCard = volumePaths.has(d.path)
              return (
                <button
                  key={d.path}
                  onClick={() => isCard ? setCardSource(d.path) : navigateTo(d.path)}
                  className={[
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm truncate',
                    currentDir === d.path
                      ? 'bg-gray-700 text-white'
                      : isCard
                      ? 'text-orange-300 hover:bg-gray-800'
                      : 'text-gray-300 hover:bg-gray-800',
                  ].join(' ')}
                >
                  <span className="text-gray-500">📁</span>
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
