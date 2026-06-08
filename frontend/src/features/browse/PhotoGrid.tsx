import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { groupByDate } from '../../lib/groupByDate'
import PhotoThumbnail from './PhotoThumbnail'
import useSelectionStore from '../../stores/useSelectionStore'
import useViewStore from '../../stores/useViewStore'
import { listStacks } from '../../api/stacks'
import type { PhotoListItem } from '../../types/api'

const STACK_COLORS = [
  'ring-blue-400',
  'ring-green-400',
  'ring-yellow-400',
  'ring-pink-400',
  'ring-purple-400',
  'ring-orange-400',
  'ring-teal-400',
  'ring-red-400',
]

function stackIdToColorClass(stackId: string): string {
  const num = parseInt(stackId.replace(/-/g, '').slice(0, 8), 16)
  return STACK_COLORS[num % STACK_COLORS.length]
}

interface Props {
  photos: PhotoListItem[]
  isLoading: boolean
  isError?: boolean
  hasMore?: boolean
  onLoadMore?: () => void
  isFetchingMore?: boolean
  infiniteScroll?: boolean
}

export default function PhotoGrid({
  photos,
  isLoading,
  isError,
  hasMore,
  onLoadMore,
  isFetchingMore,
  infiniteScroll,
}: Props) {
  const selectAll = useSelectionStore(s => s.selectAll)
  const gridVariant = useViewStore(s => s.gridVariant)
  const stacksCollapsed = useViewStore(s => s.stacksCollapsed)
  const sentinelRef = useRef<HTMLDivElement>(null)

  const hasStacks = photos.some(p => p.stack_id)
  const { data: stacks } = useQuery({
    queryKey: ['stacks'],
    queryFn: listStacks,
    enabled: hasStacks,
  })
  const stackCountMap = new Map(stacks?.map(s => [s.id, s.photo_count]) ?? [])

  const grouped = gridVariant === 'dato'
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

  useEffect(() => {
    if (!infiniteScroll || !onLoadMore || !hasMore) return
    const sentinel = sentinelRef.current
    if (!sentinel) return
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) onLoadMore()
    })
    observer.observe(sentinel)
    return () => observer.disconnect()
  }, [infiniteScroll, onLoadMore, hasMore])

  if (isLoading) {
    return <div className="flex items-center justify-center py-20 text-gray-400">Laster bilder…</div>
  }

  if (isError) {
    return <div className="flex items-center justify-center py-20 text-red-400">Kunne ikke hente bilder.</div>
  }

  const dateGroups = grouped ? groupByDate(photos) : []

  return (
    <div>
      {grouped ? (
        <div className="space-y-8">
          {dateGroups.map(group => (
            <div key={group.key}>
              <div className="flex items-center gap-3 mb-2">
                <span className="text-sm font-semibold text-gray-300">{group.label}</span>
                <span className="text-xs text-gray-500">{group.photos.length} bilder</span>
                <div className="flex-1 h-px bg-gray-800" />
              </div>
              <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1 select-none">
                {group.photos.map(photo => (
                  <PhotoThumbnail
                    key={photo.hothash}
                    photo={photo}
                    orderedHashes={orderedHashes}
                    stackCount={photo.stack_id ? stackCountMap.get(photo.stack_id) : undefined}
                    stackColor={!stacksCollapsed && photo.stack_id ? stackIdToColorClass(photo.stack_id) : undefined}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-1 select-none">
          {photos.map(photo => (
            <PhotoThumbnail
              key={photo.hothash}
              photo={photo}
              orderedHashes={orderedHashes}
              stackCount={photo.stack_id ? stackCountMap.get(photo.stack_id) : undefined}
              stackColor={!stacksCollapsed && photo.stack_id ? stackIdToColorClass(photo.stack_id) : undefined}
            />
          ))}
        </div>
      )}

      {hasMore && !infiniteScroll && (
        <div className="flex justify-center py-6">
          <button
            onClick={onLoadMore}
            disabled={isFetchingMore}
            className="rounded-lg bg-gray-700 px-6 py-2 text-sm text-white hover:bg-gray-600 disabled:opacity-50"
          >
            {isFetchingMore ? 'Laster…' : 'Last inn mer'}
          </button>
        </div>
      )}

      {infiniteScroll && <div ref={sentinelRef} className="h-1" />}
    </div>
  )
}
