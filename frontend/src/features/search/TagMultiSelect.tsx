import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listTags } from '../../api/tags'
import useTagSetStore from '../../stores/useTagSetStore'

interface Props {
  onChange: (ids: string[]) => void
}

export default function TagMultiSelect({ onChange }: Props) {
  const { tagIds } = useTagSetStore()
  const { data: tags = [] } = useQuery({ queryKey: ['tags'], queryFn: listTags })

  const active = tags.filter(t => tagIds.has(t.id))

  useEffect(() => {
    onChange([...tagIds])
  }, [tagIds])

  if (tagIds.size === 0) {
    return (
      <Link to="/tags" className="text-xs text-gray-500 hover:text-blue-400 transition-colors">
        Åpne tag-sett →
      </Link>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-wrap gap-1">
        {active.map(t => (
          <span
            key={t.id}
            className="rounded-full bg-blue-900/60 border border-blue-700 px-2 py-0.5 text-xs text-blue-200"
          >
            {t.name}
          </span>
        ))}
      </div>
      <Link to="/tags" className="text-xs text-gray-500 hover:text-blue-400 transition-colors">
        Rediger tag-sett →
      </Link>
    </div>
  )
}
