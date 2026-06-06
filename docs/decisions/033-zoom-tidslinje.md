# ADR-033: Zoom-tidslinje — semantisk zoom over bildesamlingen

**Status:** Forslag  
**Dato:** 2026-06-06

---

## Kontekst

Den eksisterende trestrukturen (ADR-006) gir presis datonavigasjon, men krever at
brukeren aktivt ekspanderer år → måned → dag — tre klikk for å komme til bilder.
Treet gir heller ingen romlig oversikt over fordelingen av bilder over tid.

**Problemet med eksisterende tidsvisninger i populære verktøy:**

- *Google Photos / Apple Photos:* Vertikal scroll er egentlig en «evig feed» forkledd
  som tidslinje. For å hoppe fra 2018 til 2024 scroller man gjennom alt imellom, eller
  bruker en upresis skrubber uten kontekstuell forankring.
- *Apple Photos År/Måneder/Dager-tabs:* Diskrete modus-bytt uten romlig kontinuitet.
  Brukeren mister plasseringssansen mellom hvert bytt.
- *Lightroom histogram-tidslinje:* Kun søk, ikke navigasjon. Ikke interaktivt.

**Nøkkelinnsikten:** Zoom i rom er intuitivt fordi det er slik kart fungerer.
Brukeren beholder alltid plasseringssansen, og navigasjon skjer ved å
«bevege seg» — ikke ved å bytte modus.

---

## Beslutning

Nytt alternativt view: **horisontal zoom-tidslinje** med kontinuerlig semantisk zoom.

Tilgjengelig som visningsvalg i BrowsePage (ved siden av PhotoGrid og PhotoTimeline).

---

## Kjerneprinsipp: én kontinuerlig tilstandsvariabel

Alt styres av ett tall: **`timePerPx`** (millisekunder per piksel).

```
timePerPx høy  →  ser mange år   →  lite detalj
timePerPx lav  →  ser få dager   →  mye detalj
```

Zoom: `timePerPx *= faktor` forankret til musens X-posisjon.
Pan: dra horisontalt (eller Shift + musehjul).

Det finnes ingen diskrete nivåer — alt er kontinuerlig, men visse
visuelle elementer blekner inn/ut ved terskelverdier:

| `timePerPx` (sekunder/px) | Tidslinjeenhet | Hva vises |
|---|---|---|
| > 30 dager | år | år-labels, densitetsflater |
| 1–30 dager | måneder | måned-labels, event-ballonger |
| 2–24 timer | dager | dag-labels, densitetssøyler |
| < 2 timer | timer | miniatyrbilder, eksakt klokkeslett |

Overgangene er CSS `opacity`-fades over en faktor-2 sone rundt terskelen —
ikke harde bytt.

---

## Render-modell: tre uavhengige lag

```
┌─────────────────────────────────────────────────────────┐
│ LAG 1 – Tidsstripe (alltid)                             │
│  år-labels  |  måned-labels  |  dag-labels              │
├─────────────────────────────────────────────────────────┤
│ LAG 2 – Densitetsvisualisering (lav-middels zoom)       │
│  Waveform-kurve fylt med gradient: farge = tetthet      │
│  Event-ballonger: avrundede piller med eventnavn        │
├─────────────────────────────────────────────────────────┤
│ LAG 3 – Miniatyrbilder (høy zoom, fadder inn over lag 2)│
│  Absolutt posisjonerte hotpreview-thumbnails per dag    │
└─────────────────────────────────────────────────────────┘
```

Alle lag er vanlige DOM-elementer med `position: absolute` og `transform: translateX`.
Ingen canvas-API — dette gir tilgjengelighet, hover-states og React-kompatibilitet.

---

## Densitetsvisualisering

**Waveform-estetikk** (ikke nakne søyler):

- Data: antall bilder per tidsenhet (måned ved lav zoom, dag ved høy)
- Form: SVG `<path>` med `smooth` bezier-interpolasjon mellom datapunkter
- Farge: gradient fra `gray-800` (tomt) til `blue-500` (tett), fylt under kurven
- Høyde: logaritmisk skala (stor kontrast også mellom sjeldne dager og rike dager)

**Event-ballonger:**
- Vises mellom år-nivå og dag-nivå (middels zoom)
- Posisjonert langs X ved eventets mediane bildedato
- Bredde: proporsjonal med eventets tidsrom (min. 80 px for lesbarhet)
- Innhold: eventnavn, eventuelt `YYYY-MM` hvis plass

---

## Thumbnail-lag

Vises når `timePerPx < 2 timer/px` (tilsvarer omtrent «7 dager synlig»).

- Bruker `hotpreview_b64` (allerede i API-responsen, ingen ekstra kall)
- Absolutt posisjonert langs X etter `taken_at`
- Vertikalt stablet innenfor dagen (max 3 rader, deretter klipp med «+N»)
- Klikk: åpner PhotoDetailPage

Virtualisering: kun thumbnails innenfor viewport ± 200 px rendres
(`IntersectionObserver` eller manuell vindu-sjekk i `useEffect`).

---

## Navigasjon til grid

Klikk på en dag-kolonne (ikke på et bilde) i thumbnail-sonen:
→ `BrowsePage` med `?taken_from=YYYY-MM-DD&taken_to=YYYY-MM-DD` — standard grid,
   sortert på dato. Tilbakeknapp returnerer til tidslinjen i samme soom-nivå.

Klikk på enkeltbilde: direkte til `PhotoDetailPage`.

---

## Data-strategi

**Ny backend-rute:** `GET /photos/timeline`

```
?granularity=year    →  [{year, count}]
?granularity=month   →  [{year, month, count}]
?granularity=day&from=YYYY-MM-DD&to=YYYY-MM-DD
                     →  [{date, count, sample_hotpreview_b64}]
```

`sample_hotpreview_b64` er ett representativt bilde per dag (nyeste) — brukes
til å fargelegge densitetsgradient med bildetone (valgfritt, kan droppes om tregt).

**Hente-strategi:**
- Lav zoom: hele samlingens år/måned-aggregat lastes én gang ved oppstart (lite data)
- Høy zoom: dag-aggregat for synlig tidsvindu lastes ved zoom-stopp
  (debounset 200 ms)
- Thumbnails: hentes kun for synlig dag-kolonne, via eksisterende paginert
  `GET /photos?taken_from=&taken_to=`

**Filter-arv:** Tidslinjen respekterer aktive filtre fra BrowsePage
(event_id, tag, photographer osv.) ved å sende disse som query-parametre til
timeline-endepunktet. Brukeren ser da tidsfordelingen av det filtrerte settet.

---

## Samspill med eksisterende views

- **PhotoGrid / PhotoTimeline:** Uberørt. Tidslinjen er et tredje alternativ,
  ikke en erstatning.
- **ADR-006 (trestruktur):** Forblir tilgjengelig i søkesiden. Zoom-tidslinjen
  er et annet brukstilfelle (utforsk/naviger vs. søk/finn).
- **usePhotoSource:** Gjenbrukes ikke direkte (tidslinjen har egen data-hook),
  men dag-grid-navigasjonen bruker `usePhotoSource` med datofilter.

---

## Begrunnelse for tekniske valg

**Horisontal (ikke vertikal) tidslinje:**
Tid assosiert med horisontal akse er universelt (graf-konvensjon, kart-tidslinje).
Vertikal scroll er allerede reservert for navigasjon innenfor viewet.

**DOM (ikke Canvas):**
Canvas gir bedre ytelse for tettvevd rendering, men krever manuell
hit-testing, tilgjengelighet og tooltips. For et personlig enkeltbruker-system
med < 50 000 bilder er DOM tilstrekkelig og enklere å vedlikeholde.

**Hotpreview (ikke coldpreview) for thumbnails:**
Hotpreview er base64 i API-responsen — ingen ekstra HTTP-kall, ingen
cache-kompleksitet. 150×150 px er tilstrekkelig for thumbnails i tidslinjen
(visningsstørrelse 40–80 px).

**Logaritmisk densitetsskala:**
En samling bilder fra en fotograf vil ha *svært* ujevn fordeling:
noen dager 300 bilder (bryllup), de fleste dager 0–5. Lineær skala
ville gjøre de fleste dager usynlige.

**Debounset data-henting (ikke per-frame):**
Zoom er fluid og kan generere 60 events/sek. Backend-kall skal kun skje
ved zoom-pause, ikke kontinuerlig.

---

## Konsekvenser

### Backend

1. Ny rute `GET /photos/timeline` i `api/photos.py`
2. Ny tjeneste `timeline_service.py` med tre aggregeringsfunksjoner
   (year, month, day) — rene SQLAlchemy group-by-spørringer
3. Nytt skjema `TimelineResponse` i `schemas/photos.py`
4. Eksisterende spørringer berøres ikke

### Frontend

```
src/features/timeline/
  ZoomTimeline.tsx       # container: zoom-state, wheel/drag-handler
  TimelineRuler.tsx      # tidsstripe med adaptive labels
  DensityLayer.tsx       # SVG waveform + event-ballonger
  ThumbnailLayer.tsx     # hotpreview-thumbnails ved høy zoom
  useTimelineData.ts     # data-fetching med debounce
src/api/timeline.ts      # GET /photos/timeline
```

5. BrowsePage: nytt view-alternativ «Tidslinje» i ViewToggle
6. useViewStore: ny verdi `'zoom-timeline'`

### Ikke i scope for første versjon

- Touch/pinch-zoom på mobil (ADR-031 håndterer mobilsupport separat)
- Redigering direkte i tidslinjen (åpne BrowsePage for det)
- Sammenligning av to tidsperioder side ved side
- Eksport av tidslinje som bilde
