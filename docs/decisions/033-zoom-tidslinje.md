# ADR-033: Zoom-tidslinje — semantisk zoom over bildesamlingen

**Status:** Under implementasjon  
**Dato:** 2026-06-06  
**Sist oppdatert:** 2026-06-06

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
Tidslinjen er et eget verktøy for utforskning og minnnavigasjon, ikke en variant av
bla-siden.

---

## Kjerneprinsipp: semantisk progressiv avsløring

En enkelt tilstandsvariabel **`pxPerDay`** (piksler per dag) styrer alt.

```
pxPerDay lav  →  ser mange år   →  skyer
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
| Klikk på bilde | Åpner BrowsePage med bildet i fokus |

### Tilstandslagring

`pxPerDay` og `topMs` lagres i localStorage via Zustand `persist` — brukeren
finner igjen nøyaktig samme zoom-posisjon ved neste besøk.

---

## Fire zoomenivåer

### Nivå 1 — År-sky (`pxPerDay < 0.4`)

- Én rad per år, klippet til år der det faktisk finnes bilder
- Skyens «tyngde» (dot-tetthet, opasitet) ∝ log(antall bilder)
- Bare årstall og skyformasjon — ingen labels, ingen bilder

### Nivå 2 — Måneds-sky (`0.4 ≤ pxPerDay < 8`)

- Én rad per måned
- 3–8 cloud-dots per måned, stabilt posisjonert (seed = dato, ikke Math.random)
- Størrelse og tetthet ∝ log(antall bilder i måneden)
- Månedsnavn dukker frem i ruler

### Nivå 3 — Mikro-bilder i skyform (`8 ≤ pxPerDay < 60`)

- Individuelle hotpreviews med stabil tilfeldig offset innenfor dagkolonnen
- `filter: drop-shadow(0 0 6px rgba(0,0,0,0.8))` opprettholder sky-assosiasjon
- Opasitet ∝ avstand fra klyngsenter (100% i midten, 40% i kanten)
- Bilder kan overlappe

### Nivå 4 — Fulle thumbnails (`pxPerDay ≥ 60`)

- Standard grid-layout innenfor dagraden
- Smooth fade-in over nivå 3

---

## Skyvisualisering: CSS metaball-teknikk

Overlappende sirkler med `blur + contrast`-filter smelter sammen til organiske
blob-former — nøyaktig som skyer. Ren CSS, ingen tredjepartsbibliotek.

```
.cloud-wrapper {
  filter: blur(15px) contrast(20);
  isolation: isolate;
}
.cloud-dot {
  background: <farge>;
  border-radius: 50%;
  position: absolute;
}
```

**Antall dots:** `ceil(sqrt(count))`, maks 40. Logaritmisk slik at kontrasten
mellom 1 og 300 bilder er lesbar uten at DOM vokser ukontrollert.

**Fargeoverlay:** Blobs rendres hvit-på-mørk for korrekt merge-effekt.
Fargelaget legges oppå med `mix-blend-mode`.

**Stabil posisjonering:** Pseudo-random offset beregnet fra datohash —
bildene hopper ikke ved re-render:

```typescript
function stableRandom(seed: string, index: number): number {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return ((h + index * 2654435761) >>> 0) / 0xFFFFFFFF
}
```

---

## Overganger mellom nivåer

Ingen harde bytt. Crossfade over et zoom-område rundt terskelen:

```
skyOpacity  = clamp(1 − (pxPerDay − THRESH) / FADE_RANGE, 0, 1)
imgOpacity  = clamp((pxPerDay − THRESH) / FADE_RANGE, 0, 1)
```

Dots i skyen krymper gradvis til thumbnails — skyen «oppløses» til bilder.

---

## Separasjon fra BrowsePage

Tidslinjen er ikke et view-alternativ i BrowsePage, men en separat side:

| ZoomTimeline (`/timeline`) | BrowsePage (`/browse`) |
|---|---|
| Utforskning, minne | Redigering, seleksjon |
| Hele samlingen | Filtrert etter event/tag/sesjon |
| Temporal navigasjon | Flat liste, dato-sortert |
| Ingen batch-operasjoner | Seleksjon, tildeling |

**Klikk på bilde** → `BrowsePage?taken_from=YYYY-MM-DD&focus=<hothash>` — åpner
browse-view på riktig dato med bildet fremhevet.

---

## Data-strategi

**Eksisterende backend-rute (implementert):** `GET /photos/timeline`

```
?granularity=year    →  [{year, count}]
?granularity=month   →  [{year, month, count}]
?granularity=day     →  [{date, count}]
```

**Hente-strategi:**
- Årsdata: hentes én gang ved oppstart, stale 5 min
- Måneds/dag-data: hentes for synlig vindu + buffer, debounset 180 ms
- Thumbnails: hentes via `GET /photos?taken_after=&taken_before=`, kun ved nivå 3–4

**Klipping:** År uten data vises ikke. `yearBuckets` bestemmer y-aksen sin rekkevidde.

---

## Tilleggsideer (fremtidig scope)

**Klyngdeteksjon:** Finn automatisk hendelsesklynger (mange bilder tett i tid,
atskilt av tomme perioder) og tegn en myk kontur rundt dem. Kan foreslå event-navn.

**Fargekoding etter årstid:** Sky-farge basert på dato — blå (vinter), grønn (vår),
oransje (sommer), rød (høst). Visuelt mønster uten å lese labels.

**Minnekort-modus:** Klikk på en dag → pop-up «på denne datoen for N år siden»
med bilder fra samme kalenderdag i andre år.

**Fotograf-filter:** Skyene viser kun bilder fra valgt fotograf.
Avslører hvem som er mest aktiv i hvilke perioder.

**Glemte bilder:** Fremhev perioder med bilder men ingen tilknyttede events —
uregistrerte minner.

**Scroll-momentum (inertia):** Etter at brukeren slipper scroll, fortsetter
panorering med avtagende fart. Standard på mobil, forbedrer desktop-UX.

**Årsring-oversikt:** Ved max zoom-ut, ett sirkelpanel per år der sektorer (måneder)
har tykkelse ∝ bildetall. Kompakt kaleidoskopisk oversikt.

---

## Begrunnelse for tekniske valg

**Vertikal (ikke horisontal) tidslinje:**
Standard scroll = pan i tid er intuitivt og konflikter ikke med zoom.
Hele bredden frigjøres til innhold. Kalenderanalogien er sterkere vertikalt.

**Metaball (ikke SVG waveform):**
`blur + contrast` er ren CSS, ingen canvas eller SVG-manipulasjon.
Resultatet er organisk og distinkt — ikke et diagram. Støttes i alle
moderne nettlesere uten polyfill.

**DOM (ikke Canvas):**
Canvas krever manuell hit-testing og tilgjengelighet. DOM gir
hover-states, `title`-attributter og React-kompatibilitet uten overhead.

**Stabil tilfeldig posisjon (hash, ikke Math.random):**
Bilder og dots skal ikke flytte seg ved zoom, re-render eller navigasjon.
Deterministisk seed basert på dato gir stabilt, men naturlig utseende.

**Hotpreview (ikke coldpreview) for thumbnails:**
Base64 i API-responsen — ingen ekstra HTTP-kall. 150×150 px er tilstrekkelig
for visningsstørrelser 20–100 px.

**Logaritmisk tetthets-skala:**
Bildedistribusjon er ekstrem: noen dager 300 bilder, de fleste 0–5.
Lineær skala gjør de fleste dager usynlige.

---

## Konsekvenser

### Backend (implementert)

- `GET /photos/timeline?granularity=year|month|day`
- `GET /photos/timeline/events`
- Rene SQLAlchemy GROUP BY-spørringer, ingen nye tabeller

### Frontend (delvis implementert)

```
src/features/timeline/
  ZoomTimeline.tsx      # container: zoom-state, Ctrl+scroll
  TimelineRows.tsx      # virtual rendering av rader
  TimelineRow.tsx       # én rad (dag/måned/år)
  buildRows.ts          # ren funksjon for radgenerering
  useTimelineData.ts    # data-fetching, debounset
src/api/timeline.ts     # GET /photos/timeline
```

**Gjenstår:**
- Sky-visualisering med metaball-teknikk (erstatter densitetsbar)
- Mikro-bilder i skyform (nivå 3)
- Stabil tilfeldig plassering (hash-seed)
- Smooth crossfade mellom nivåene
- Egen rute `/timeline` + nav-lenke
- Zustand persist for `pxPerDay` + `topMs`
- Klikk-til-browse med focus-parameter

### Ikke i scope

- Touch/pinch-zoom på mobil (ADR-031)
- Redigering direkte i tidslinjen
- Sammenligning av to tidsperioder side ved side
- Eksport av tidslinje som bilde
