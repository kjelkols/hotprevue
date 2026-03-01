import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { listTags } from '../api/tags'
import useNavigationStore from '../stores/useNavigationStore'

export default function TagsPage() {
  const navigate = useNavigate()
  const { data: tags = [], isLoading, isError } = useQuery({
    queryKey: ['tags'],
    queryFn: listTags,
  })

  const addSource = useNavigationStore(s => s.addSource)
  const setTarget = useNavigationStore(s => s.setTarget)
  const sources = useNavigationStore(s => s.sources)
  const navTarget = useNavigationStore(s => s.target)

  function tagUrl(name: string) {
    return `/browse?tag=${encodeURIComponent(name)}&title=${encodeURIComponent(name)}`
  }

  function handleSource(name: string) {
    addSource({ id: name, type: 'tag', label: name, url: tagUrl(name) })
  }

  function handleTarget(name: string) {
    setTarget({ id: name, type: 'tag', label: name, url: tagUrl(name) })
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
          {tags.map(tag => {
            const isSource = sources.some(s => s.id === tag.name)
            const isTarget = navTarget?.id === tag.name
            return (
              <li key={tag.name} className="flex items-center gap-2 rounded-xl bg-gray-800 px-4 py-3">
                <button
                  onClick={() => navigate(tagUrl(tag.name))}
                  className="flex-1 text-left font-medium hover:text-blue-300 transition-colors truncate"
                >
                  {tag.name}
                </button>
                <span className="text-sm text-gray-400 shrink-0">{tag.photo_count} bilder</span>
                <button
                  onClick={() => handleSource(tag.name)}
                  disabled={isTarget}
                  className={`rounded-lg px-2 py-1 text-xs transition-colors shrink-0 ${
                    isSource
                      ? 'bg-gray-600 text-white hover:bg-gray-500'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40'
                  }`}
                >
                  {isSource ? 'Kilde ✓' : 'Kilde'}
                </button>
                <button
                  onClick={() => handleTarget(tag.name)}
                  disabled={isSource}
                  className={`rounded-lg px-2 py-1 text-xs transition-colors shrink-0 ${
                    isTarget
                      ? 'bg-amber-700 text-white hover:bg-amber-600'
                      : 'bg-gray-700 text-gray-300 hover:bg-gray-600 disabled:opacity-40'
                  }`}
                >
                  {isTarget ? 'Mål ✓' : 'Mål'}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
