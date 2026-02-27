# Collection som presentasjonsmedium

Sist oppdatert: 2026-02-26

---

## Det grunnleggende metaforskiftet

Collection er ikke et fotoalbum med tekstkort. Det er et **manuskript** — en referenseliste over innhold som kan "fremføres" på mange måter:

```
Collection (manuskript)
    │
    ├── In-app CollectionView      ← kurateringsverktøy (grid)
    ├── In-app Visningsmodus       ← fremføring i nettleser
    ├── HTML-eksport               ← selvstendig presentasjon for USB, deling
    └── (fremtid) PDF, utskrift
```

Samme collection — flere renderinger. Det som er lagret i databasen er **innholdsreferanser og struktur**: hothash, tekst, rekkefølge. Ikke layoutbeslutninger. Ikke bildepixler. Beslutninger om *presentasjon* (farger, fonter, animasjoner, layout) hører til renderer-laget, ikke til Collection-objektet.

---

## Datamodell — beslutninger

### `is_text_card` → `card_type: str | None`

En boolean er lukket — den sier bare "er" eller "er ikke". En `card_type`-streng er åpen.

```
card_type = None    → photo-element (hothash er satt)
card_type = 'text'  → tekstkort: title + text_content
(fremtid, uten migrering) 'heading', 'divider', 'quote', 'map', ...
```

Å legge til en ny korttype krever en ny frontend-komponent og en ny `card_type`-verdi — ingen DB-migrering, ingen API-endringer. Det er dette som menes med at utvidelse *ikke påvirker arkitekturen*.

**Beslutning:** Migrer fra `is_text_card BOOLEAN NOT NULL` til `card_type TEXT NULL`.

---

### `notes: str | None` — forelesningsnotater

For live foredrag er det klassiske problemet skillet mellom hva *publikum ser* og hva *presentatøren trenger*. Forelesningsnotater er tekst som tilhører en bestemt slide, men som ikke vises på presentasjonsskjermen.

`notes TEXT NULL` legges til på `CollectionItem`:

- Lagres i DB — synkroniseres mellom maskiner med databasen
- Vises i in-app Visningsmodus som et togglbart notatpanel (tastatursnarvei `N`)
- I HTML-eksport: skjult som standard, men inkludert i HTML-en og kan vises med `N`-tastetrykk under fremføring
- Vises aldri i CollectionView-grid eller andre visninger enn Visningsmodus

**Beslutning:** Legg til `notes TEXT NULL` på `CollectionItem` i samme migrering som `card_type`.

---

### `card_data: dict | None` — escape-luke for fremtidige korttyper

Noen fremtidige korttyper trenger strukturerte data utover `title`/`text_content`:

- **Duo-slide** (`card_type = 'duo'`): to bilder side om side → trenger to hothashes
- **Kart-slide** (`card_type = 'map'`): GPS-koordinater → trenger lat/lng
- **Trio-slide**: tre bilder

I stedet for å legge til nye kolonner per korttype: én JSONB-kolonne som escape-luke.

```json
// Duo-slide: card_data = {"hothash2": "abc123", "layout": "side-by-side"}
// Kart-slide: card_data = {"lat": 59.9, "lng": 10.7, "zoom": 12}
```

Kolonnen er `NULL` for alle eksisterende korttyper. Fremtidig kode leser fra den ved behov.

**Beslutning:** Legg til `card_data JSONB NULL` på `CollectionItem` i samme migrering. Brukes ikke i v1 — men ingen ny migrering trengs når behovet oppstår.

---

## Datamodell — oppsummert

Etter migreringen ser `CollectionItem`-radene slik ut:

| card_type | hothash | title | text_content | caption | notes | card_data |
|-----------|---------|-------|--------------|---------|-------|-----------|
| `NULL`    | `abc123`| —     | —            | "Drøbak havn, 1987" | "Kontekst: dette ble..." | — |
| `'text'`  | —       | "Kapittel 2" | "Vi reiste nordover..." | — | "Husk å fortelle om..." | — |
| `'heading'` (fremtid) | — | "Del I" | — | — | — | — |
| `'duo'` (fremtid) | `abc123` | — | — | — | — | `{"hothash2": "def456"}` |

---

## Tekstkort-formatering

`text_content` er ren tekst med `\n` for linjeskift — ikke markdown. Begrunnelse:
- Markdown krever en parser (ekstra avhengighet i frontend)
- For lysbildeforedrag er prosa med naturlige avsnittsbrytinger nok
- Fremtidig markdown-støtte kan legges til uten DB-endring (felt er uendret, rendering endres)

`title` er alltid ren tekst (én linje).

Dersom rikt innhold (markdown, kursiv, lister) viser seg nødvendig vurderes det da.

---

## Slide-konseptet — diskriminert union

Frontend modellerer slides som en diskriminert union:

```typescript
type PhotoSlide = {
  kind: 'photo'
  hothash: string
  caption: string | null
  notes: string | null
  collection_item_id: string
}

type TextSlide = {
  kind: 'text'
  title: string | null
  text_content: string | null
  notes: string | null
  collection_item_id: string
}

// Fremtid uten arkitekturendring:
// type HeadingSlide = { kind: 'heading'; title: string; notes: string | null }
// type DividerSlide  = { kind: 'divider' }
// type DuoSlide      = { kind: 'duo'; hothash: string; hothash2: string; notes: string | null }

type Slide = PhotoSlide | TextSlide
```

`SlidePresenter` tar `Slide[]` og `currentIndex`. Switcher på `kind` for å rende riktig komponent. Ingenting annet.

---

## Visningsmodus — arkitektur

### Rute

Dedikert siderute — ikke modal/overlay:

| Rute | Kontekst |
|------|----------|
| `/collections/:id/present` | Collection-presentasjon |
| `/events/:id/present` | Event-presentasjon |

Slide-indeks i URL som query-param: `?slide=3`. Oppdateres med `history.replaceState` (ikke route-push — fyller ikke opp historikken). Åpner man `?slide=5` direkte starter man på riktig slide.

Nettleserens Tilbake-knapp tar brukeren tilbake til CollectionView/EventView.

### Navigasjon

```
ArrowRight / ArrowLeft  → neste / forrige slide
Escape                  → tilbake til CollectionView
N                       → toggle forelesningsnotater
F                       → toggle fullskjerm (Fullscreen API)
Space                   → neste slide (alternativ)
```

### Layout — foto-slide

```
┌──────────────────────────────────────────────────┐
│  ← Tilbake    [tittel]          [3 / 12]  [←][→] │
├──────────────────────────────────────────────────┤
│                                                  │
│                  [coldpreview]                   │
│               object-contain                     │
│               mørk bakgrunn                      │
│                                                  │
│        [caption — italic, grå, sentrert]         │
├──────────────────────────────────────────────────┤
│  [Notater — synlig kun ved N-toggle]              │
│  Lorem ipsum speaker notes...                    │
└──────────────────────────────────────────────────┘
```

Caption vises under bildet — ikke som hover-overlay (det er grid-mønsteret).

### Layout — tekstkort-slide

```
┌──────────────────────────────────────────────────┐
│  ← Tilbake    [tittel]          [3 / 12]  [←][→] │
├──────────────────────────────────────────────────┤
│                                                  │
│         [title — stor, hvit, sentrert]           │
│                                                  │
│   [text_content — prose, grå, maks 65 tegn       │
│    bredde, sentrert vertikalt på siden]           │
│                                                  │
├──────────────────────────────────────────────────┤
│  [Notater — synlig kun ved N-toggle]              │
└──────────────────────────────────────────────────┘
```

### Komponentarkitektur

```
components/ui/
  SlidePresenter.tsx          ← Delt: navigation, keyboard, slide-switching, fullscreen

features/present/
  PhotoSlideView.tsx          ← Coldpreview + caption
  TextSlideView.tsx           ← Formatert tekstkort
  SlideNotesPanel.tsx         ← Forelesningsnotater (toggle med N)

pages/
  CollectionPresentPage.tsx   ← Henter collection items → Slide[], kaller SlidePresenter
  EventPresentPage.tsx        ← Henter event photos → Slide[], kaller SlidePresenter
```

`CollectionPresentPage` og `EventPresentPage` er tynne adapter-sider — datahenting og mapping til `Slide[]`. All presentasjonslogikk i `SlidePresenter`.

### Events i visningsmodus

Events er uordnede — rekkefølge i Visningsmodus er `taken_at ASC`. Ingen tekstkort (events har ikke CollectionItems), ingen captions. Ellers identisk `SlidePresenter`.

### Kobling til PhotoDetailPage

Fra en foto-slide kan brukeren åpne PhotoDetailPage for full metadata og korreksjon. Sett `useDetailNavStore` med collection-rekkefølgen (kun photo-hothashes, tekstkort filtrert ut) og `returnTo` = `/collections/:id/present?slide=N`. Da fungerer ← → i PhotoDetailPage innen collection-sekvensen.

---

## HTML-eksport — fremtidig funksjon

*Eksport er ikke planlagt implementert nå. Notert her som arkitekturell kontekst.*

### Konsept

Backend "kompilerer" Collection-manuskriptet til en selvbærende ZIP-fil:

```
collection-tittel.zip/
  index.html              ← Lysbildevisning uten ekstra programvare
  slides/
    001_<hothash>.jpg     ← Coldpreview for foto-slides
    003_<hothash>.jpg     ← (002 er tekstkort — ingen bildefil)
```

`index.html` er en selvstendig nettside som kjører lysbildevisning offline. Tekortort rendres som HTML-slides. Notater inkludert men skjult (toggle med `N`).

### Bildekvalitet

| Modus | Bildekilde | Kommentar |
|-------|------------|-----------|
| `compact` | Coldpreview (800–1200px JPEG) | Alltid tilgjengelig, korreksjon innbakt |
| `full` | Beste JPEG ImageFile; fallback til coldpreview | Originalfil kan mangle (ekstern disk) |

RAW-filer eksporteres aldri direkte — kan ikke vises i nettleser.

For en 1920×1080-projector er 1200px coldpreview mer enn tilstrekkelig.

### Frontend og originalfiler

Frontend har tilgang til lokale disker (via Electron). En fremtidig eksportfunksjon kan hente originalfiler direkte fra disk i frontend og kombinere dem med metadata fra backend, i stedet for å sende store filer via API. Dette noteres som mulighet — ikke noe som trengs nå.

### Eksport-endepunkt (skisse)

```
GET /collections/{id}/export?quality=compact
→ Content-Type: application/zip
→ Content-Disposition: attachment; filename="<navn>.zip"
```

---

## Fremtidige korttyper

Alle håndteres via `card_type`-discriminatoren + evt. `card_data`. Ingen migrering:

| card_type | Innhold | card_data |
|-----------|---------|-----------|
| `'heading'` | Stor seksjonstittel | — |
| `'divider'` | Visuell separator | — |
| `'quote'` | Sitat med attribuering | — |
| `'duo'` | To bilder side om side | `{"hothash2": "..."}` |
| `'map'` | GPS-kart-slide | `{"lat": 59.9, "lng": 10.7}` |

---

## Hva som ikke besluttes nå

| Funksjon | Kommentar |
|----------|-----------|
| Per-collection fargetema | `theme TEXT` på Collection — legg til ved behov |
| Overgangseeffekter | CSS — ingen DB-endring |
| Auto-play med timing | `display_duration_ms INT` på CollectionItem — legg til ved behov |
| To-skjerm presenter-modus | WebSocket-synkronisering — avansert, fremtidig |
| Duo/trio-slides | Bruk `card_data` når implementert |
| Full-oppløsning eksport | Frontend henter fra lokal disk (Electron), kombinerer med ZIP fra backend |

---

## Beslutningsoversikt

| # | Beslutning | Status |
|---|------------|--------|
| 1 | `is_text_card BOOL` → `card_type TEXT NULL` | Implementeres nå |
| 2 | `notes TEXT NULL` på CollectionItem | Implementeres nå |
| 3 | `card_data JSONB NULL` på CollectionItem | Implementeres nå (brukes ikke ennå) |
| 4 | Visningsmodus som dedikert siderute | Implementeres nå |
| 5 | `SlidePresenter` delt for collection + event | Implementeres ved Visningsmodus |
| 6 | Slide-navigasjon: URL-param + replaceState | Implementeres ved Visningsmodus |
| 7 | Forelesningsnotater toggle (`N`) | Implementeres ved Visningsmodus |
| 8 | Fullskjerm via Fullscreen API | Implementeres ved Visningsmodus |
| 9 | HTML-eksport | Fremtidig |
| 10 | Full-oppløsning eksport via Electron | Fremtidig |
