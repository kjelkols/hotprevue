import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface LocationEditorStore {
  hothashes: string[]
  addPhotos(hashes: string[]): void
  clearPhotos(): void
}

const useLocationEditorStore = create<LocationEditorStore>()(
  persist(
    (set) => ({
      hothashes: [],
      addPhotos: (hashes) =>
        set((state) => ({
          hothashes: [...new Set([...state.hothashes, ...hashes])],
        })),
      clearPhotos: () => set({ hothashes: [] }),
    }),
    { name: 'hotprevue-location-editor' }
  )
)

export default useLocationEditorStore
