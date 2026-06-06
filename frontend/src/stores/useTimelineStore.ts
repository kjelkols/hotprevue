import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const DAY_MS = 86_400_000

interface TimelineStore {
  pxPerDay: number
  topMs: number
  setPxPerDay: (v: number) => void
  setTopMs: (v: number) => void
}

const useTimelineStore = create<TimelineStore>()(
  persist(
    (set) => ({
      pxPerDay: 2,
      topMs: Date.now() - 730 * DAY_MS,
      setPxPerDay: (pxPerDay) => set({ pxPerDay }),
      setTopMs: (topMs) => set({ topMs }),
    }),
    { name: 'hotprevue-timeline-v2' }
  )
)

export default useTimelineStore
