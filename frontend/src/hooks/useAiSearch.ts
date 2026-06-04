import { useQuery } from '@tanstack/react-query'
import { aiSearch } from '../api/ai'
import { listPhotos } from '../api/photos'
import type { PhotoListItem } from '../types/api'

export interface AiSearchState {
  photos: PhotoListItem[]
  isLoading: boolean
  isError: boolean
  isEmpty: boolean
}

export function useAiSearch(q: string): AiSearchState {
  const trimmed = q.trim()

  const searchQuery = useQuery({
    queryKey: ['ai-search', trimmed],
    queryFn: () => aiSearch(trimmed, 20),
    enabled: trimmed.length > 0,
    staleTime: 60_000,
  })

  const results = searchQuery.data ?? []
  const hothashes = results.map(r => r.hothash)

  const photosQuery = useQuery({
    queryKey: ['photos-by-hothash', hothashes],
    queryFn: () => listPhotos({ hothashes, limit: hothashes.length }),
    enabled: hothashes.length > 0,
    staleTime: 60_000,
  })

  const scoreIndex = new Map(results.map((r, i) => [r.hothash, i]))
  const photos = [...(photosQuery.data ?? [])].sort(
    (a, b) => (scoreIndex.get(a.hothash) ?? 999) - (scoreIndex.get(b.hothash) ?? 999)
  )

  return {
    photos,
    isLoading: searchQuery.isLoading || (hothashes.length > 0 && photosQuery.isLoading),
    isError: searchQuery.isError || photosQuery.isError,
    isEmpty: trimmed.length > 0 && !searchQuery.isLoading && photos.length === 0,
  }
}
