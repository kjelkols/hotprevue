import { create } from 'zustand'

/**
 * Navigasjonskontekst for PhotoDetailPage + gjeldende grid-rekkefølge.
 *
 * - `gridOrder`: rekkefølgen på bildene i det synlige gridet. Vedlikeholdes
 *   av PhotoGrid (effect) og leses *lazily* (via getState()) i
 *   PhotoThumbnail-handlere — shift-klikk-range og åpning av detaljside.
 *   Å lese lazily i stedet for å sende listen som prop til hver thumbnail
 *   er det som gjør memoiseringen av PhotoThumbnail effektiv.
 * - `hothashes`: listen detaljsiden blar i (forrige/neste). Settes i det
 *   et bilde åpnes — et øyeblikksbilde, slik at blaingen er stabil selv om
 *   gridet bak refetches.
 * - `backUrl`: fallback-URL for «Tilbake» når historikken er tom
 *   (direktelenke/refresh). Ellers brukes navigate(-1).
 */
interface PhotoNavStore {
  gridOrder: string[]
  hothashes: string[]
  backUrl: string
  setGridOrder: (hothashes: string[]) => void
  setHothashes: (hothashes: string[]) => void
  setBackUrl: (url: string) => void
}

const usePhotoNavStore = create<PhotoNavStore>()(set => ({
  gridOrder: [],
  hothashes: [],
  backUrl: '/browse',
  setGridOrder: (gridOrder) => set({ gridOrder }),
  setHothashes: (hothashes) => set({ hothashes }),
  setBackUrl: (backUrl) => set({ backUrl }),
}))

export default usePhotoNavStore
