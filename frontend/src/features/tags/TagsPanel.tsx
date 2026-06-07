import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { listTags, tagsForPhotos } from '../../api/tags'
import useSelectionStore from '../../stores/useSelectionStore'
import TagCreateInput from './TagCreateInput'
import TagList from './TagList'

export default function TagsPanel() {
  const [filter, setFilter] = useState('')
  const selected = useSelectionStore(s => s.selected)
  const hothashes = [...selected]

  const { data: tags = [], isLoading, isError } = useQuery({
    queryKey: ['tags'],
    queryFn: listTags,
  })

  const { data: tagMap = {} } = useQuery({
    queryKey: ['tagsForPhotos', hothashes],
    queryFn: () => tagsForPhotos(hothashes),
    enabled: hothashes.length > 0,
  })

  const visible = filter
    ? tags.filter(t => t.name.toLowerCase().includes(filter.toLowerCase()))
    : tags

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center gap-4 px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold flex-1">Tags</h1>
        {hothashes.length > 0 && (
          <span className="text-xs text-blue-400 bg-blue-900/40 px-2 py-0.5 rounded">
            {hothashes.length} bilder valgt
          </span>
        )}
      </div>

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

        <TagList tags={visible} selection={hothashes} tagMap={tagMap} />
      </div>
    </div>
  )
}
