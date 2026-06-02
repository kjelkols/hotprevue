import { create } from 'zustand'
import { createSelectionSlice, type SelectionSlice } from '../utils/selectionSlice'
import type { PrescanFileEntry } from '../types/api'

interface PreorganiserStore extends SelectionSlice {
  currentDir: string
  dateGrouping: boolean
  dateAnchor: string | null
  setCurrentDir: (dir: string) => void
  toggleDateGrouping: () => void
  selectByTimeRange: (files: PrescanFileEntry[], from: Date, to: Date) => void
  selectDate: (date: string, paths: string[]) => void
  toggleDate: (date: string, paths: string[]) => void
  selectDateRange: (fromDate: string, toDate: string, allFiles: PrescanFileEntry[]) => void
}

const usePreorganiserStore = create<PreorganiserStore>()(set => ({
  currentDir: '',
  dateGrouping: true,
  dateAnchor: null,
  ...createSelectionSlice(set),

  setCurrentDir: (dir) => set({ currentDir: dir, selected: new Set(), anchor: null, dateAnchor: null }),

  toggleDateGrouping: () => set(s => ({ dateGrouping: !s.dateGrouping })),

  selectByTimeRange: (files, from, to) => set(() => {
    const ids = files.filter(f => f.taken_at && new Date(f.taken_at) >= from && new Date(f.taken_at) <= to).map(f => f.file_path)
    return { selected: new Set(ids), anchor: null, dateAnchor: null }
  }),

  // Enkelt klikk: velg kun denne datoen
  selectDate: (date, paths) => set(() => ({
    selected: new Set(paths),
    anchor: null,
    dateAnchor: date,
  })),

  // Ctrl+klikk: legg til / fjern hele datoen
  toggleDate: (date, paths) => set(s => {
    const allSelected = paths.every(p => s.selected.has(p))
    const next = new Set(s.selected)
    if (allSelected) paths.forEach(p => next.delete(p))
    else paths.forEach(p => next.add(p))
    return { selected: next, anchor: null, dateAnchor: date }
  }),

  // Shift+klikk: velg alle datoer mellom anchor og denne
  selectDateRange: (fromDate, toDate, allFiles) => set(s => {
    const [d1, d2] = [fromDate, toDate].sort()
    const paths = allFiles
      .filter(f => { const d = f.taken_at?.slice(0, 10) ?? 'ukjent'; return d >= d1 && d <= d2 })
      .map(f => f.file_path)
    return { selected: new Set(paths), anchor: null, dateAnchor: s.dateAnchor }
  }),
}))

export default usePreorganiserStore
