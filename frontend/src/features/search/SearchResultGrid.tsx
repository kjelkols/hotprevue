import { useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { executeSearch } from '../../api/searches'
import PhotoThumbnail from '../browse/PhotoThumbnail'
import useSelectionStore from '../../stores/useSelectionStore'
import type { SearchCriterion } from '../../types/api'

const LIMIT = 100

interface Props {
  logic: 'AND' | 'OR'
  criteria: SearchCriterion[]
  sort?: string
}

export default function SearchResultGrid({ logic, criteria, sort = 'taken_at_desc' }: Props) {
  const selectAll = useSelectionStore(s => s.selectAll)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery({
      queryKey: ['search-results', { logic, criteria, sort }],
      queryFn: ({ pageParam }) =>
        executeSearch({ logic, criteria, sort, limit: LIMIT, offset: pageParam as number }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, _allPages, lastPageParam) =>
        lastPage.length < LIMIT ? undefined : (lastPageParam as number) + LIMIT,
    })

  const photos = data?.pages.flat() ?? []
  const orderedHashes = photos.map(p => p.hothash)

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
        e.preventDefault()
        selectAll(orderedHashes)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [orderedHashes, selectAll])

  if (isLoading) {
    return <div className="py-20 text-center text-gray-400">Søker…</div>
  }

  if (isError) {
    return <div className="py-20 text-center text-red-400">Søket feilet.</div>
  }

  return (
    <div>
      <p className="text-sm text-gray-500 mb-3">{photos.length} bilder</p>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1 select-none">
        {photos.map(photo => (
          <PhotoThumbnail key={photo.hothash} photo={photo} orderedHashes={orderedHashes} />
        ))}
      </div>
      {hasNextPage && (
        <div className="flex justify-center py-6">
          <button
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="rounded-lg bg-gray-700 px-6 py-2 text-sm text-white hover:bg-gray-600 disabled:opacity-50"
          >
            {isFetchingNextPage ? 'Laster…' : 'Last inn mer'}
          </button>
        </div>
      )}
    </div>
  )
}
