import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DAY_MS = 86_400_000

interface TimelineStore {
  pxPerDay: number
  topMs: number
  initialized: boolean
  setPxPerDay: (v: number) => void
  setTopMs: (v: number) => void
  setInitialized: () => void
}

const useTimelineStore = create<TimelineStore>()(
  persist(
    (set) => ({
      pxPerDay: 2,
      topMs: Date.now() - 730 * DAY_MS,
      initialized: false,
      setPxPerDay: (pxPerDay) => set({ pxPerDay }),
      setTopMs: (topMs) => set({ topMs }),
      setInitialized: () => set({ initialized: true }),
    }),
    { name: 'hotprevue-timeline-v1' }
  )
)

export default useTimelineStore
