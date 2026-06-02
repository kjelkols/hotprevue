import { useState, useEffect } from 'react'

interface PinnedFolder {
  name: string
  path: string
}

const KEY = 'hotprevue-preorganisering-pinned'

export function usePinnedFolders() {
  const [pinned, setPinned] = useState<PinnedFolder[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(KEY) ?? '[]')
    } catch {
      return []
    }
  })

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(pinned))
  }, [pinned])

  function pin(path: string) {
    const name = path.split('/').filter(Boolean).pop() ?? path
    setPinned(prev => prev.some(p => p.path === path) ? prev : [...prev, { name, path }])
  }

  function unpin(path: string) {
    setPinned(prev => prev.filter(p => p.path !== path))
  }

  function isPinned(path: string) {
    return pinned.some(p => p.path === path)
  }

  return { pinned, pin, unpin, isPinned }
}
