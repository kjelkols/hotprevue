import { create } from 'zustand'
import { createSelectionSlice, type SelectionSlice } from '../utils/selectionSlice'
import type { PrescanFileEntry } from '../types/api'

interface PreorganiserStore extends SelectionSlice {
  currentDir: string
  setCurrentDir: (dir: string) => void
  selectByTimeRange: (files: PrescanFileEntry[], from: Date, to: Date) => void
}

const usePreorganiserStore = create<PreorganiserStore>()(set => ({
  currentDir: '',
  ...createSelectionSlice(set),

  setCurrentDir: (dir) => set({ currentDir: dir, selected: new Set(), anchor: null }),

  selectByTimeRange: (files, from, to) => set(() => {
    const ids: string[] = []
    for (const f of files) {
      if (!f.taken_at) continue
      const d = new Date(f.taken_at)
      if (d >= from && d <= to) ids.push(f.file_path)
    }
    return { selected: new Set(ids), anchor: ids[ids.length - 1] ?? null }
  }),
}))

export default usePreorganiserStore
