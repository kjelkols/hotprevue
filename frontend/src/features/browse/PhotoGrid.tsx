import { useInfiniteQuery } from '@tanstack/react-query'
import { listPhotos } from '../../api/photos'
import PhotoThumbnail from './PhotoThumbnail'

const LIMIT = 100

export default function PhotoGrid() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, isError } =
    useInfiniteQuery({
      queryKey: ['photos'],
      queryFn: ({ pageParam }) => listPhotos({ limit: LIMIT, offset: pageParam, sort: 'taken_at_desc' }),
      initialPageParam: 0,
      getNextPageParam: (lastPage, _allPages, lastPageParam) => {
        if (lastPage.length < LIMIT) return undefined
        return (lastPageParam as number) + LIMIT
      },
    })

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

  const photos = data?.pages.flat() ?? []
  const orderedHashes = photos.map(p => p.hothash)

  return (
    <div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1">
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
