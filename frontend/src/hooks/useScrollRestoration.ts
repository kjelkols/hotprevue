import { useLayoutEffect, useEffect, type RefObject } from 'react'
import { useLocation } from 'react-router-dom'

/**
 * Scroll-restaurering for appens scroll-container (AppLayout sin
 * overflow-y-auto-div — vinduet scroller aldri, så nettleserens innebygde
 * restaurering virker ikke her).
 *
 * Posisjonen lagres per `location.key` — React Router gir hver
 * historikkoppføring en unik nøkkel. Dermed:
 *  - tilbake/frem (pop): samme key → posisjonen gjenopprettes
 *  - vanlig navigasjon (push): ny key → starter på toppen
 *
 * Innholdet lastes asynkront (React Query), så containeren er ofte for lav
 * i det navigasjonen skjer. Vi poller derfor med requestAnimationFrame til
 * containeren er høy nok til å ta imot posisjonen, med en kort tidsfrist.
 */

/** Lagrede posisjoner per historikkoppføring. Modul-lokal: overlever
 *  navigasjon, nullstilles ved full reload (da er historikk-keyene uansett
 *  nye, bortsett fra 'default' som alltid starter på toppen). */
const positions = new Map<string, number>()

/** Hvor lenge vi venter på at async innhold skal gi containeren nok høyde. */
const RESTORE_TIMEOUT_MS = 2000

export function useScrollRestoration(ref: RefObject<HTMLElement>) {
  const location = useLocation()

  // Lagre posisjonen fortløpende. Scroll-eventen er passiv og billig;
  // å lagre på hvert event er enklere og sikrere enn å prøve å fange
  // «siste posisjon før navigasjon» i en cleanup.
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const key = location.key
    function onScroll() {
      positions.set(key, el!.scrollTop)
    }
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [ref, location.key])

  // Gjenopprett (eller nullstill) posisjonen når historikkoppføringen bytter.
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const saved = positions.get(location.key)

    if (saved === undefined || saved === 0) {
      el.scrollTop = 0
      return
    }

    let raf = 0
    const deadline = performance.now() + RESTORE_TIMEOUT_MS
    function attempt() {
      // Høy nok? Sett posisjonen og gi oss. scrollHeight vokser etter hvert
      // som React Query-data rendres; før det ville scrollTop bli klippet.
      if (el!.scrollHeight - el!.clientHeight >= saved!) {
        el!.scrollTop = saved!
        return
      }
      if (performance.now() < deadline) raf = requestAnimationFrame(attempt)
      else el!.scrollTop = el!.scrollHeight // best effort: så langt ned som mulig
    }
    attempt()
    return () => cancelAnimationFrame(raf)
  }, [ref, location.key])
}
