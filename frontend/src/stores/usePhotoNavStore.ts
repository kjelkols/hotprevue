import { create } from 'zustand'

interface PhotoNavStore {
  hothashes: string[]
  backUrl: string
  setHothashes: (hothashes: string[]) => void
  setBackUrl: (url: string) => void
}

const usePhotoNavStore = create<PhotoNavStore>()(set => ({
  hothashes: [],
  backUrl: '/browse',
  setHothashes: (hothashes) => set({ hothashes }),
  setBackUrl: (backUrl) => set({ backUrl }),
}))

export default usePhotoNavStore
