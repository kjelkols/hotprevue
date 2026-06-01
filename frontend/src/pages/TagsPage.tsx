import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listTags } from '../api/tags'

export default function TagsPage() {
  const navigate = useNavigate()
  const { data: tags = [], isLoading, isError } = useQuery({
    queryKey: ['tags'],
    queryFn: listTags,
  })

  function tagUrl(name: string) {
    return `/browse?tag=${encodeURIComponent(name)}&title=${encodeURIComponent(name)}`
  }

  return (
    <div className="min-h-full bg-gray-950 text-white">
      <div className="flex items-center px-4 py-3 border-b border-gray-800">
        <h1 className="text-xl font-semibold">Tags</h1>
      </div>

      <div className="p-4 max-w-2xl mx-auto">
        {isLoading && <p className="text-gray-400 py-8 text-center">Laster…</p>}
        {isError && <p className="text-red-400 py-8 text-center">Kunne ikke hente tags.</p>}
        {!isLoading && tags.length === 0 && (
          <p className="text-gray-500 py-8 text-center">Ingen tags registrert ennå.</p>
        )}
        <ul className="flex flex-col gap-2">
          {tags.map(tag => (
            <li key={tag.name} className="flex items-center gap-2 rounded-xl bg-gray-800 px-4 py-3">
              <button
                onClick={() => navigate(tagUrl(tag.name))}
                className="flex-1 text-left font-medium hover:text-blue-300 transition-colors truncate"
              >
                {tag.name}
              </button>
              <span className="text-sm text-gray-400 shrink-0">{tag.photo_count} bilder</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
