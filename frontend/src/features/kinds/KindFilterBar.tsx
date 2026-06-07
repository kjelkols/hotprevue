import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listKinds } from '../../api/kinds'
import useKindFilterStore from '../../stores/useKindFilterStore'

export default function KindFilterBar() {
  const { data: kinds = [] } = useQuery({ queryKey: ['kinds'], queryFn: listKinds })
  const { selectedKindIds, toggle, setAll, initFromKinds } = useKindFilterStore()

  useEffect(() => {
    if (kinds.length > 0) initFromKinds(kinds)
  }, [kinds])

  if (kinds.length <= 1) return null

  const allSelected = kinds.every((k) => selectedKindIds.includes(k.id))

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-950">
      <span className="text-xs text-gray-500 shrink-0">Kind:</span>
      <button
        onClick={() => setAll(allSelected ? [] : kinds.map((k) => k.id))}
        className={`text-xs px-2 py-0.5 rounded transition-colors ${
          allSelected ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
        }`}
      >
        Alle
      </button>
      {kinds.map((kind) => {
        const selected = selectedKindIds.includes(kind.id)
        return (
          <button
            key={kind.id}
            onClick={() => toggle(kind.id)}
            className={`flex items-center gap-1.5 text-xs px-2 py-0.5 rounded transition-colors ${
              selected ? 'bg-gray-700 text-gray-200' : 'bg-gray-800 text-gray-500 hover:bg-gray-700'
            }`}
          >
            {kind.color && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{ backgroundColor: kind.color }}
              />
            )}
            {kind.name}
          </button>
        )
      })}
    </div>
  )
}
