import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { browseDirectory, listVolumes } from '../api/system'
import { listShortcuts } from '../api/shortcuts'
import type { BrowseResult, BrowseDir, Shortcut } from '../types/api'

interface Options {
  initialPath?: string
  enabled?: boolean
}

export interface BrowseState {
  path: string
  setPath: (p: string) => void
  reset: () => void
  navigateUp: () => void
  data: BrowseResult | undefined
  isLoading: boolean
  volumes: BrowseDir[]
  shortcuts: Shortcut[]
}

export function useBrowse({ initialPath = '', enabled = true }: Options = {}): BrowseState {
  const [path, setPath] = useState(initialPath)

  const { data: shortcuts = [] } = useQuery({
    queryKey: ['shortcuts'],
    queryFn: listShortcuts,
    enabled,
  })

  const { data: volumes = [] } = useQuery({
    queryKey: ['volumes'],
    queryFn: listVolumes,
    enabled,
    staleTime: 10_000,
  })

  // Fallback til første snarveg hvis ingen sti er valgt
  const resolvedPath = path === '' && shortcuts.length > 0 ? shortcuts[0].path : path

  const { data, isLoading } = useQuery({
    queryKey: ['browse', resolvedPath],
    queryFn: () => browseDirectory(resolvedPath),
    enabled,
  })

  return {
    path: data?.path ?? resolvedPath,
    setPath,
    reset: () => setPath(initialPath),
    navigateUp: () => { if (data?.parent) setPath(data.parent) },
    data,
    isLoading,
    volumes,
    shortcuts,
  }
}
