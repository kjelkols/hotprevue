import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type GridVariant = 'standard' | 'dato'

export const GRID_VARIANTS: { value: GridVariant; label: string }[] = [
  { value: 'standard', label: 'Standard' },
  { value: 'dato', label: 'Dato' },
]

interface ViewStore {
  gridVariant: GridVariant
  setGridVariant: (v: GridVariant) => void
}

const useViewStore = create<ViewStore>()(
  persist(
    (set) => ({
      gridVariant: 'standard',
      setGridVariant: (v) => set({ gridVariant: v }),
    }),
    { name: 'hotprevue-view-prefs' }
  )
)

export default useViewStore
