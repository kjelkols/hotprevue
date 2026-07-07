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
  const hiddenCount = kinds.length - selectedKindIds.filter((id) => kinds.some((k) => k.id === id)).length

  return (
    <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-gray-800 bg-gray-950">
      <span className="text-xs text-gray-500 shrink-0">Kind:</span>
      {/* Filteret er persisted (overlever reload) — gjør det umulig å overse
          at bilder er skjult, og gi en ett-klikks vei tilbake til alt. */}
      {!allSelected && (
        <span className="flex items-center gap-2 text-xs text-amber-400 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {hiddenCount} kind{hiddenCount === 1 ? '' : 's'} skjult
          <button
            onClick={() => setAll(kinds.map((k) => k.id))}
            className="underline underline-offset-2 hover:text-amber-300 transition-colors"
          >
            Nullstill
          </button>
        </span>
      )}
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
