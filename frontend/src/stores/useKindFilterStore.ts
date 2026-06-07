import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { KindOut } from '../types/api'

interface KindFilterStore {
  selectedKindIds: string[]
  initialized: boolean
  initFromKinds: (kinds: KindOut[]) => void
  toggle: (id: string) => void
  setAll: (ids: string[]) => void
}

const useKindFilterStore = create<KindFilterStore>()(
  persist(
    (set, get) => ({
      selectedKindIds: [],
      initialized: false,

      initFromKinds: (kinds: KindOut[]) => {
        const { initialized, selectedKindIds } = get()
        const allIds = kinds.map((k) => k.id)

        if (!initialized) {
          // First run: select all non-hidden kinds
          const visibleIds = kinds.filter((k) => !k.hidden_by_default).map((k) => k.id)
          set({ selectedKindIds: visibleIds, initialized: true })
          return
        }

        // Add any new kinds that appeared after initialization
        const newIds = allIds.filter((id) => !selectedKindIds.includes(id))
        if (newIds.length > 0) {
          // New kinds are auto-checked (visible by default)
          set({ selectedKindIds: [...selectedKindIds, ...newIds] })
        }
      },

      toggle: (id: string) =>
        set((state) => ({
          selectedKindIds: state.selectedKindIds.includes(id)
            ? state.selectedKindIds.filter((k) => k !== id)
            : [...state.selectedKindIds, id],
        })),

      setAll: (ids: string[]) => set({ selectedKindIds: ids }),
    }),
    { name: 'hotprevue-kind-filter' }
  )
)

export default useKindFilterStore
