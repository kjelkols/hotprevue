# ADR-031: Mobilstøtte

**Status:** Delvis implementert  
**Dato:** 2026-06-05

## Kontekst

Hotprevue er opprinnelig designet som en desktopapplikasjon. Brukeren ønsker
å kunne bla gjennom og dele bilder fra mobiltelefon — særlig etter at bilder
er overført fra telefonen til hjemmeserver og slettet fra enheten.

Serveren er tilgjengelig via Tailscale, så selve nettverkstilgangen er løst.
Utfordringen er at UI-et er desktop-first og ikke fungerer på liten skjerm.

## Implementert

### Responsiv navigasjon (TopNav)

Under 1024px skjules alle navigasjonslenker. Et `☰`-ikon vises til høyre.
Klikk åpner en vertikal dropdown med alle lenker. Lukkes ved navigasjon
eller klikk utenfor.

Breakpoint: `lg` (1024px) — skjermbredder under dette anses som
mobil/nettbrett.

### Stack-layout i PhotoDetailPage

Under 1024px: bilde øverst (`h-[50vh]`), scrollbart metadatapanel under.
Kompakt header med Tilbake-knapp, nedlastingsknapp og ‹›-navigasjonsknapper.

Over 1024px: eksisterende SplitPane-layout er uendret.

Implementert via `useIsMobile`-hook (`src/hooks/useIsMobile.ts`) med
`window.matchMedia`.

### Touch-støtte i ZoomableImage

`useImageZoom` fikk non-passive touch-hendelser:

| Gestur | Handling |
|---|---|
| Én finger, ikke zoomet | Sveip til neste/forrige bilde |
| Én finger, zoomet | Panorering |
| To fingre | Pinch-to-zoom (1×–4×) |
| Dobbelttrykk | Veksle mellom 1× og 2× |

Sveip utløses kun hvis horisontal bevegelse ≥ 50px og er minst 1,5× større
enn vertikal bevegelse (unngår konflikt med vertikal scrolling).

`ZoomableImage` eksponerer `onSwipeLeft` og `onSwipeRight`-props.
`PhotoDetailPage` sender navigasjonsfunksjoner til disse.

### PWA — «Legg til på startskjerm»

`public/manifest.json` med `display: standalone`, ikoner (192px + 512px) og
`theme_color: #111827`. Meta-tagger i `index.html`:
`apple-mobile-web-app-capable`, `apple-mobile-web-app-status-bar-style`,
`apple-mobile-web-app-title`, `theme-color`.

- **iOS Safari**: Del-knapp → «Legg til på hjem-skjerm» — fungerer over HTTP.
- **Android Chrome**: Krever HTTPS for automatisk installasjonsprompt, men
  manuell «Legg til på startskjerm» fra Chrome-menyen fungerer over HTTP.

## Planlagt

### Responsiv BrowsePage

Thumbnails og PhotoGrid er ikke tilpasset touch. Aktuelle forbedringer:
- Større tap-targets (thumbnail-størrelse)
- Long-press som erstatning for høyreklikk-kontekstmeny
- Horisontal scroll i tidslinje-visning

### Optimalisering av bildehøyde

`h-[50vh]` er fast høyde i mobilvisning. Alternativt: beregn høyde fra
`photo.width`/`photo.height` for å gi korrekt aspektforhold uten svart bord.

### Orientering (portrait/landscape)

I landscape-modus på mobil er `50vh` for lite til å vise bildet godt.
Side-by-side layout (bilde venstre, metadata høyre) kan være bedre for
`orientation: landscape` med liten skjermhøyde.
