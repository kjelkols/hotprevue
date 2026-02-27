import { create } from 'zustand'

interface CollectionViewStore {
  // InsertionPoint — null means "at end of collection" (resolved to items.length in CollectionGrid)
  insertionIndex: number | null
  setInsertionPoint: (index: number | null) => void
  // Set by CollectionGrid on mount/unmount
  activeCollectionId: string | null
  setActiveCollectionId: (id: string | null) => void
}

const useCollectionViewStore = create<CollectionViewStore>()(set => ({
  insertionIndex: null,
  setInsertionPoint: (index) => set({ insertionIndex: index }),
  activeCollectionId: null,
  setActiveCollectionId: (id) => set({ activeCollectionId: id }),
}))

export default useCollectionViewStore
