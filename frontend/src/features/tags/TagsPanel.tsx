import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listTags } from '../../api/tags'
import useTagSetStore from '../../stores/useTagSetStore'
import TagCreateInput from './TagCreateInput'
import TagList from './TagList'

export default function TagsPanel() {
  const navigate = useNavigate()
  const [filter, setFilter] = useState('')
  const { tagIds, toggle, clear } = useTagSetStore()

  const { data: tags = [], isLoading, isError } = useQuery({
    queryKey: ['tags'],
    queryFn: listTags,
  })

  const activeTags = tags.filter(t => tagIds.has(t.id))
  const visible = filter
    ? tags.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
    : tags

  return (
    <div className="min-h-full bg-gray-950 text-white pb-24">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800">
        <button
          onClick={() => navigate(-1)}
          className="text-gray-400 hover:text-white transition-colors text-sm"
        >
          ← Tilbake
        </button>
        <h1 className="text-xl font-semibold flex-1">Tags</h1>
      </div>

      {activeTags.length > 0 && (
        <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 shrink-0">Aktivt sett:</span>
          {activeTags.map(t => (
            <button
              key={t.id}
              onClick={() => toggle(t.id)}
              className="flex items-center gap-1 rounded-full bg-blue-900/60 border border-blue-700 px-2.5 py-0.5 text-xs text-blue-200 hover:bg-red-900/40 hover:border-red-700 hover:text-red-300 transition-colors"
            >
              {t.name} <span>×</span>
            </button>
          ))}
          <button
            onClick={clear}
            className="text-xs text-gray-500 hover:text-gray-300 transition-colors ml-1"
          >
            Tøm
          </button>
        </div>
      )}

      <div className="p-4 max-w-2xl mx-auto flex flex-col gap-3">
        <TagCreateInput />

        <input
          value={filter}
          onChange={e => setFilter(e.target.value)}
          placeholder="Filtrer tags…"
          className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-gray-500"
        />

        {isLoading && <p className="text-gray-400 py-8 text-center text-sm">Laster…</p>}
        {isError && <p className="text-red-400 py-8 text-center text-sm">Kunne ikke hente tags.</p>}

        <TagList tags={visible} />
      </div>
    </div>
  )
}
