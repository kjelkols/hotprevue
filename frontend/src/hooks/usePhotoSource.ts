import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { listPhotos } from '../api/photos'
import { executeSearch } from '../api/searches'
import { getSettings } from '../api/settings'
import type { PhotoListItem, SearchCriterion } from '../types/api'

export interface PhotoSourceParams {
  sessionId?: string
  eventId?: string
  kindIds?: string[]
  takenFrom?: string   // ISO datetime — filter by date range
  takenTo?: string     // ISO datetime
  logic?: 'AND' | 'OR'
  criteria?: SearchCriterion[]
  dateFilter?: string
  enabled?: boolean
}

export interface PhotoSourceResult {
  photos: PhotoListItem[]
  isLoading: boolean
  isError: boolean
  hasMore: boolean
  loadMore: () => void
  isFetchingMore: boolean
  infiniteScroll: boolean
}

export function usePhotoSource(params: PhotoSourceParams): PhotoSourceResult {
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: getSettings,
  })

  const limit = settings?.machine.photo_limit ?? 1000
  const infiniteScroll = settings?.machine.infinite_scroll ?? false
  const isSearch = params.criteria !== undefined
  const enabled = params.enabled !== false

  const query = useInfiniteQuery({
    queryKey: isSearch
      ? ['search-results', { logic: params.logic, criteria: params.criteria, dateFilter: params.dateFilter }]
      : ['photos', { sessionId: params.sessionId, eventId: params.eventId, kindIds: params.kindIds, takenFrom: params.takenFrom, takenTo: params.takenTo }],
    queryFn: ({ pageParam }) =>
      isSearch
        ? executeSearch({
            logic: params.logic ?? 'AND',
            criteria: params.criteria!,
            sort: 'taken_at_desc',
            date_filter: params.dateFilter,
            limit,
            offset: pageParam as number,
          })
        : listPhotos({
            sort: params.takenFrom ? 'taken_at_asc' : 'taken_at_desc',
            sessionId: params.sessionId,
            eventId: params.eventId,
            kindIds: params.kindIds,
            taken_after: params.takenFrom,
            taken_before: params.takenTo,
            limit,
            offset: pageParam as number,
          }),
    initialPageParam: 0,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length < limit ? undefined : (lastPageParam as number) + limit,
    enabled,
  })

  return {
    photos: query.data?.pages.flat() ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    hasMore: !!query.hasNextPage,
    loadMore: () => { query.fetchNextPage() },
    isFetchingMore: query.isFetchingNextPage,
    infiniteScroll,
  }
}
