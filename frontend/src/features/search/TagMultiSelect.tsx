import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listTags } from '../../api/tags'
import useTagSetStore from '../../stores/useTagSetStore'

interface Props {
  value: string[]
  onChange: (ids: string[]) => void
}

export default function TagMultiSelect({ value, onChange }: Props) {
  const { tagIds } = useTagSetStore()
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: listTags })
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current && value.length === 0 && tagIds.size > 0) {
      onChange([...tagIds])
    }
    initialized.current = true
  }, [])

  const knownIds = new Set(tags.map(t => t.id))
  const deletedIds = value.filter(id => !knownIds.has(id))
  const activeTags = tags.filter(t => value.includes(t.id))

  const clipboardIds = [...tagIds].sort()
  const currentIds = [...value].sort()
  const clipboardDiffers =
    clipboardIds.length !== currentIds.length ||
    clipboardIds.some((id, i) => id !== currentIds[i])

  return (
    <div className="flex flex-col gap-1.5">
      {activeTags.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {activeTags.map(t => (
            <span
              key={t.id}
              className="rounded-full bg-blue-900/60 border border-blue-700 px-2 py-0.5 text-xs text-blue-200"
            >
              {t.name}
            </span>
          ))}
        </div>
      ) : (
        <span className="text-xs text-gray-500">Ingen tags valgt</span>
      )}

      {deletedIds.length > 0 && (
        <p className="text-xs text-amber-400">
          ⚠ {deletedIds.length} {deletedIds.length === 1 ? 'tag er' : 'tags er'} slettet siden søket ble lagret
        </p>
      )}

      <div className="flex gap-2 flex-wrap">
        {clipboardDiffers && tagIds.size > 0 && (
          <button
            onClick={() => onChange([...tagIds])}
            className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
          >
            Synk med clipboard
          </button>
        )}
        <Link to="/tags" className="text-xs text-gray-500 hover:text-blue-400 transition-colors">
          Rediger tag-sett →
        </Link>
      </div>
    </div>
  )
}
