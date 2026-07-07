import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type GridVariant = 'standard' | 'dato'
export type TimelineView = 'grid' | 'tree' | 'zoom'
/** Visningsvalget i BrowsePage: rutenett eller tre-tidslinje. */
export type BrowseView = 'grid' | 'timeline'

export const GRID_VARIANTS: { value: GridVariant; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'dato', label: 'Dato' },
]

export const TIMELINE_VIEWS: { value: TimelineView; label: string }[] = [
  { value: 'grid', label: 'Grid' },
  { value: 'tree', label: 'Tre' },
  { value: 'zoom', label: 'Zoom' },
]

// Persisted visningspreferanser — overlever navigasjon og reload, slik at
// et view ser likt ut når brukeren kommer tilbake til det.
interface ViewStore {
  gridVariant: GridVariant
  setGridVariant: (v: GridVariant) => void
  stacksCollapsed: boolean
  setStacksCollapsed: (v: boolean) => void
  timelineView: TimelineView
  setTimelineView: (v: TimelineView) => void
  browseView: BrowseView
  setBrowseView: (v: BrowseView) => void
}

const useViewStore = create<ViewStore>()(
  persist(
    (set) => ({
      gridVariant: 'standard',
      setGridVariant: (v) => set({ gridVariant: v }),
      stacksCollapsed: true,
      setStacksCollapsed: (v) => set({ stacksCollapsed: v }),
      timelineView: 'grid',
      setTimelineView: (v) => set({ timelineView: v }),
      browseView: 'grid',
      setBrowseView: (v) => set({ browseView: v }),
    }),
    { name: 'hotprevue-view-prefs' }
  )
)

export default useViewStore
