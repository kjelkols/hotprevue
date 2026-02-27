# Zoom-forbedringer i visningsmodus — utsatt

**Status:** Gjeldende implementasjon fungerer, men har kjente mangler.

---

## Gjeldende implementasjon

`useZoomPan` (i `features/present/`) håndterer:
- Scrollhjul zoomer inn/ut mot musepekeren (1×–4×), 10 % per scrollsteg
- Dra panorerer når zoomet inn
- `key`-prop på `PhotoSlideView` nullstiller zoom ved slidebytte

---

## Kjente mangler

### 1. Panoreringsbegrensning mangler

Brukeren kan dra bildet helt utenfor skjermen. Det finnes ingen «clamp» som holder
bildet innenfor det synlige området. Standard oppførsel i f.eks. nettlesere og Apple
Photos er at bildet ikke kan flyttes lenger enn til kanten av skjermen.

**Løsning:** Etter hvert `setOffset`-kall: beregn maks tillatt offset basert på
`scale`, bildedimensjoner og containerdimensjoner, og klamp `x`/`y` innenfor dette.
Krever tilgang til bildets intrinsiske dimensjoner (`img.naturalWidth/Height`) og
containerens dimensjoner (`getBoundingClientRect`).

### 2. Dobbelt-klikk for nullstilling mangler

Standard i de fleste bildevisere: dobbeltklikk nullstiller zoom og panorering.

**Løsning:** `onDoubleClick` på containerelementet → sett `scale = 1`, `offset = {x:0, y:0}`.
Må skilles fra enkelt-klikk-navigasjon (som skjer via `SlideNavZones`). Siden
dobbelt-klikk er langsommere enn ett klikk, kan `stopPropagation` brukes.

### 3. Zoom-hastighet er fast

10 % per scrollsteg (`factor = 1.1`) er relativt langsomt på høy-DPI-hjul.
`WheelEvent.deltaMode` skiller mellom `pixel` (0), `line` (1) og `page` (2) —
bør brukes til å normalisere `deltaY` på tvers av mus, trackpad og touchpad.

**Løsning:**
```typescript
const delta = e.deltaMode === 0 ? e.deltaY / 100 : e.deltaY
const factor = Math.exp(-delta * 0.2)  // eksponentielt, jevnere enn lineær
```

### 4. Klype-til-zoom (touchpad/mobil) mangler

`WheelEvent` med `ctrlKey === true` er nettleserens standardsignal for klype-zoom
(pinch-to-zoom på trackpad/mobil). For øyeblikket behandles dette identisk med
vanlig scroll.

**Løsning:** Sjekk `e.ctrlKey` — hvis true, bruk en annen (høyere) zoom-faktor
tilpasset presise trackpad-bevegelser. `e.preventDefault()` hindrer allerede at
nettleseren håndterer klype-zoom selv (takket være non-passiv lytter).

---

## Prioritering

| Forbedring | Innsats | Effekt |
|---|---|---|
| Panoreringsbegrensning | Middels | Høy — unngår at bildet forsvinner |
| Dobbelt-klikk reset | Lav | Middels — standard forventning |
| Zoom-hastighet (deltaMode) | Lav | Lav — fungerer ok i dag |
| Klype-til-zoom | Lav | Middels — relevant for trackpad-brukere |

Panoreringsbegrensning og dobbelt-klikk-reset bør implementeres sammen.
