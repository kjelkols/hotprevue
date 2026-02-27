import { create } from 'zustand'

interface CollectionViewStore {
  activeCollectionId: string | null
  setActiveCollectionId: (id: string | null) => void
}

const useCollectionViewStore = create<CollectionViewStore>()(set => ({
  activeCollectionId: null,
  setActiveCollectionId: (id) => set({ activeCollectionId: id }),
}))

export default useCollectionViewStore
