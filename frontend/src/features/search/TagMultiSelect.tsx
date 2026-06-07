import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listTags } from '../../api/tags'

interface Props {
  value: string[]
  onChange: (ids: string[]) => void
}

export default function TagMultiSelect({ value, onChange }: Props) {
  const [open, setOpen] = useState(false)
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: listTags })

  const selected = tags.filter(t => value.includes(t.id))
  const remaining = tags.filter(t => !value.includes(t.id))

  function add(id: string) { onChange([...value, id]) }
  function remove(id: string) { onChange(value.filter(v => v !== id)) }

  return (
    <div className="flex flex-col gap-1 relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map(t => (
            <span
              key={t.id}
              className="flex items-center gap-1 rounded-full bg-blue-900/60 border border-blue-700 px-2 py-0.5 text-xs text-blue-200"
            >
              {t.name}
              <button onClick={() => remove(t.id)} className="hover:text-white">×</button>
            </span>
          ))}
        </div>
      )}
      {remaining.length > 0 && (
        <div className="relative">
          <button
            onClick={() => setOpen(v => !v)}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            + Legg til tag
          </button>
          {open && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
              <ul className="absolute top-full left-0 mt-1 z-20 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto min-w-36">
                {remaining.map(t => (
                  <li
                    key={t.id}
                    onClick={() => { add(t.id); setOpen(false) }}
                    className="flex justify-between px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700 cursor-pointer"
                  >
                    <span>{t.name}</span>
                    <span className="text-gray-500 text-xs ml-3">{t.photo_count}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
      {tags.length === 0 && (
        <span className="text-xs text-gray-500">Ingen tags.</span>
      )}
    </div>
  )
}
