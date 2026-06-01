import { create } from 'zustand'

interface PhotoNavStore {
  hothashes: string[]
  setHothashes: (hothashes: string[]) => void
}

const usePhotoNavStore = create<PhotoNavStore>()(set => ({
  hothashes: [],
  setHothashes: (hothashes) => set({ hothashes }),
}))

export default usePhotoNavStore
