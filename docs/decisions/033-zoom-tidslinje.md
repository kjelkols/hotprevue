# ADR-033: Zoom-tidslinje — semantisk zoom over bildesamlingen

**Status:** Implementert  
**Dato:** 2026-06-06  
**Sist oppdatert:** 2026-06-07

---

## Kontekst

Den eksisterende trestrukturen (ADR-006) gir presis datonavigasjon, men krever at
brukeren aktivt ekspanderer år → måned → dag. Treet gir heller ingen romlig oversikt
over fordelingen av bilder over tid.

**Problemet med eksisterende tidsvisninger:**

- *Google Photos / Apple Photos:* Vertikal scroll er egentlig en «evig feed» forkledd
  som tidslinje. Å hoppe fra 2018 til 2024 krever enten massevis av scroll eller en
  upresis skrubber.
- *Apple Photos År/Måneder/Dager-tabs:* Diskrete modus-bytt uten romlig kontinuitet.
  Brukeren mister plasseringssansen mellom hvert bytt.
- *Lightroom histogram-tidslinje:* Kun søk, ikke navigasjon.

**Nøkkelinnsikten:** Zoom i rom er intuitivt fordi det er slik kart fungerer.
Brukeren beholder alltid plasseringssansen og navigerer ved å «bevege seg»,
ikke ved å bytte modus.

---

## Beslutning

**Separat rute `/timeline`** med egen nav-lenke — ikke et alternativ innenfor BrowsePage.
Tidslinjen er et eget verktøy for utforskning og minnenavigasjon, ikke en variant av
bla-siden.

---

## Kjerneprinsipp: semantisk progressiv avsløring

En enkelt tilstandsvariabel **`pxPerDay`** (piksler per dag) styrer alt.

```
pxPerDay lav  →  ser mange år   →  skyer / tetthetsstrek
pxPerDay høy  →  ser få dager   →  thumbnails
```

Det finnes ingen diskrete nivåer — alt er kontinuerlig. Visuelle elementer fadder
inn og ut ved terskelverdier.

### Akse-orientering

**Vertikal tidslinje:** Y = tid (nedover), X = innhold (hele bredden).

- Standard scroll panorerer i tid — ingen konflikt med zoom
- Hele skjermbredden brukes til bilder
- Kalenderanalogien: tid går nedover

### Interaksjon

| Handling | Effekt |
|---|---|
| Scroll | Panorerer i tid (opp/ned) |
| Ctrl+scroll | Zoom inn/ut, forankret på musens Y-posisjon |
| +/− knapper | Alternativ zoom |
| Klikk på rad | Åpner BrowsePage med datointervallet filtrert |

### Tilstandslagring

`pxPerDay` og `topMs` lagres i localStorage via Zustand `persist`
(nøkkel `hotprevue-timeline-v2`) — brukeren finner igjen nøyaktig samme
zoom-posisjon ved neste besøk. `initialized`-flagget lagres **ikke** persistert;
auto-senter kjører én gang per session.

---

## Tre granularitetsnivåer

### Nivå 1 — Årsvisning (`pxPerDay < 0.4`, gran = `year`)

Rader < 22 px høye bruker **tetthetsstrek** (solid rgba-bakgrunn).
Opasiteten skalerer som `0.12 + (count/maxCount) * 0.65` — år med mange bilder
er tydelig mørkere blå enn tomme år.

Rader ≥ 22 px bruker **cloud-dots** (se Skyvisualisering).

### Nivå 2 — Månedssvisning (`0.4 ≤ pxPerDay < 8`, gran = `month`)

- Én rad per måned, typisk 30–200 px høy
- Cloud-dots med blur, tetthet og størrelse ∝ count/maxCount
- Månedsnavn i ruler, årstall som subLabel for januar

### Nivå 3 — Dagvisning med thumbnails (`pxPerDay ≥ 8`, gran = `day`)

- `showThumbnails = pxPerDay ≥ 20` — hotpreviews hentes fra API
- Crossfade: sky fader ut mens thumbnails fader inn over pxPerDay 20→50
- `cloudOpacity = clamp(1 − (pxPerDay − 20) / 30, 0, 1)`
- `thumbOpacity = clamp((pxPerDay − 20) / 30, 0, 1)`

---

## Skyvisualisering

### Tetthetsstrek (rader < 22 px)

```tsx
<div style={{ background: `rgba(96,165,250,${0.12 + intensity * 0.65})` }} />
```

Brukes fordi CSS blur klippes av parent `overflow-hidden` ved veldig lave høyder.

### Cloud-dots (rader ≥ 22 px)

Overlappende sirkler med `filter: blur()` gir organiske blob-former:

```tsx
<div style={{ filter: `blur(${blurPx}px)`, opacity }}>
  {dots.map(dot => <div style={{ background: `rgba(96,165,250,${a})`, borderRadius: '50%' }} />)}
</div>
```

**Viktig:** `overflow-hidden` er **fjernet** fra content-diven i TimelineRow —
blur-effekten må tillates å blø utover radgrensen for å se naturlig ut.
Thumbnail-containeren beholder sin egen `overflow-hidden`.

**Antall dots:** `ceil(sqrt(count))`, maks 35. Logaritmisk skalering.

**Stabil posisjonering:** Deterministisk hash-based pseudo-random:

```typescript
function stableRandom(seed: string, index: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return ((h + index * 2654435761) >>> 0) / 0xFFFFFFFF
}
```

---

## Navigasjon og kontekst

### Auto-senter ved oppstart

Første gang tidslinjen lastes per session beregnes start-zoom:

```typescript
const totalDays = (maxYear + 1 - minYear) * 365.25
const newPpd = containerHeight / (totalDays + 120)  // 2 mnd margin
setTopMs(Date.UTC(minYear, 0, 1) - 60 * DAY_MS)
```

Viser hele samlingens tidsperiode på én skjerm. Kjøres kun én gang per
session (session-ref, ikke persistert).

### Sticky tidsanker

Et overlay øverst i ruleren (`position: absolute, z-index: 20`) viser alltid
nåværende dato:

- År-nivå: `2024`
- Måneds-nivå: `jan 2024`
- Dag-nivå: `7. jun 2024`

Oppdateres i sanntid ved scroll/zoom, med gradient-bakgrunn som fader ned.

### Klikk → BrowsePage

```
/browse?taken_from=YYYY-MM-DD&taken_to=YYYY-MM-DD&title=<label>
```

BrowsePage viser `← Tidslinje`-knapp tilbake. Dato-sortering aktiveres automatisk.

### Tooltip

`title`-attributt på content-diven viser alltid fullstendig dato + bildestall,
uavhengig av hva ruleren viser:

- Med bilder: `"3 bilder · 23. feb 2024"`
- Tom dag: `"23. feb 2024"`

---

## Separasjon fra BrowsePage

| ZoomTimeline (`/timeline`) | BrowsePage (`/browse`) |
|---|---|
| Utforskning, minne | Redigering, seleksjon |
| Hele samlingen | Filtrert etter event/tag/sesjon |
| Temporal navigasjon | Flat liste, dato-sortert |
| Ingen batch-operasjoner | Seleksjon, tildeling |

---

## Data-strategi

### Backend-ruter

```
GET /photos/timeline?granularity=year             →  [{year, count}]
GET /photos/timeline?granularity=month&from_date=&to_date=  →  [{year, month, count}]
GET /photos/timeline?granularity=day&from_date=&to_date=    →  [{date, count}]
GET /photos/timeline/events                       →  [{id, name, from_date, to_date, count}]
```

**Viktig:** Rutene `/timeline` og `/timeline/events` må være registrert **før**
`/{hothash}` i FastAPI-routeren. FastAPI matcher i rekkefølge — en generell
path-parameter vil ellers skygge alle konkrete ruter.

### Hente-strategi

- `yearBuckets`: hentes én gang ved oppstart, stale 5 min. Ingen datofilter.
- `buckets` (måned/dag): hentes for synlig vindu + 30 dagers buffer, debounset 180 ms.
- `thumbnails`: hentes via `GET /photos?taken_after=&taken_before=`, kun når
  `pxPerDay ≥ 20` (debounset).

### Dataklipping

`yearBounds = { minYear, maxYear }` beregnes fra yearBuckets med `count > 0`.
Rader genereres kun for år i dette spennet — årsrekker uten bilder rendres ikke.

---

## Filer

```
frontend/src/
  features/timeline/
    ZoomTimeline.tsx      # Container: zoom-state, Ctrl+scroll, auto-senter, tidsanker
    TimelineRows.tsx      # Genererer og renderer alle rader
    TimelineRow.tsx       # Én rad (dag/måned/år): ruler + cloud/thumbnails + tooltip
    CloudDots.tsx         # Tetthetsstrek (< 22px) eller cloud-dots (≥ 22px)
    buildRows.ts          # Ren funksjon: topMs+bottomMs+pxPerDay → RowData[]
    useTimelineData.ts    # React Query-wrapper: buckets, yearBuckets, thumbnails
  pages/
    TimelinePage.tsx      # Tynn wrapper rundt ZoomTimeline
  stores/
    useTimelineStore.ts   # Zustand persist: pxPerDay + topMs (nøkkel v2)
  api/
    timeline.ts           # getTimelineBuckets, getTimelineEvents

backend/
  api/photos.py           # GET /photos/timeline, /photos/timeline/events (før /{hothash})
  services/photo_service.py  # timeline_buckets(), timeline_events()
```

---

## Kjente begrensninger

- **Bilder med feil EXIF-dato** vises i tidslinjen med sin lagrede `taken_at` —
  ingen automatisk filtrering av fremtidsdatoer.
- **Touch/pinch-zoom** ikke implementert (ADR-031).
- Jitter på thumbnails er begrenset til 12 px for å unngå overlapping ved høy zoom.

---

## Tilleggsideer (fremtidig scope)

- **Fargekoding etter årstid:** blå (vinter), grønn (vår), gul (sommer), rød (høst)
- **Klyngdeteksjon:** finn hendelsesklynger og tegn kontur rundt dem
- **Minnekort-modus:** «på denne datoen for N år siden» ved klikk på dag
- **Fotograf-filter:** sky-visualisering kun for valgt fotograf
- **Glemte bilder:** fremhev perioder med bilder men ingen tilknyttede events
- **Scroll-momentum:** inertia etter scroll-slipp
- **Årsring-oversikt:** sirkelpanel per år ved max zoom-ut

---

## Begrunnelse for tekniske valg

**Vertikal (ikke horisontal) tidslinje:**
Standard scroll = pan i tid er intuitivt og konflikter ikke med zoom.
Hele bredden frigjøres til innhold.

**Tetthetsstrek for små rader (ikke metaball):**
CSS `blur + contrast` (ekte metaball) krever en isolert container uten
`overflow: hidden` på noen foreldre. Gitt at hver rad er en liten slice i en
scrollbar liste, er dette upraktisk. Tetthetsstrek er enklere og mer lesbar
ved lave høyder.

**DOM (ikke Canvas):**
Canvas krever manuell hit-testing og tilgjengelighet. DOM gir
hover-states, `title`-attributter og React-kompatibilitet.

**Stabil hash-seed (ikke Math.random):**
Bilder og dots skal ikke flytte seg ved zoom, re-render eller navigasjon.
