import { useEffect } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import { listPhotos } from '../../api/photos'
import PhotoThumbnail from './PhotoThumbnail'
import useSelectionStore from '../../stores/useSelectionStore'

const LIMIT = 100

interface Props {
  sessionId?: string
  eventId?: string
  tag?: string
}

export default function PhotoGrid({ sessionId, eventId, tag }: Props) {
  const selectAll = useSelectionStore(s => s.selectAll)

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery({
      queryKey: ['photos', { sessionId, eventId, tag }],
      queryFn: ({ pageParam }) => listPhotos({ limit: LIMIT, offset: pageParam, sort: 'taken_at_desc', sessionId, eventId, tag }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, _allPages, lastPageParam) => {
        if (lastPage.length < LIMIT) return undefined
        return (lastPageParam as number) + LIMIT
      },
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
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        Laster bilder…
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center py-20 text-red-400">
        Kunne ikke hente bilder.
      </div>
    )
  }

  return (
    <div>
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
