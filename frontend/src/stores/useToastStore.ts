import { create } from 'zustand'

interface ToastStore {
  message: string | null
  show: (msg: string) => void
  clear: () => void
}

const useToastStore = create<ToastStore>((set) => ({
  message: null,
  show: (msg) => {
    set({ message: msg })
    setTimeout(() => set({ message: null }), 5000)
  },
  clear: () => set({ message: null }),
}))

export default useToastStore
