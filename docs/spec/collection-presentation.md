# Collection som presentasjonsmedium

Sist oppdatert: 2026-02-27

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

## Datamodell — CollectionItem

### Forenkling: to typer og ingen mer

CollectionItem støtter nøyaktig to innholdstyper — **foto** og **tekst** — og denne listen fryses. Ingen `card_type`-streng, ingen `card_data` JSONB. Typen bestemmes av hvilken FK som er satt:

| Felt | Verdi | Betyr |
|------|-------|-------|
| `hothash` | satt, `text_item_id` null | Foto-element |
| `text_item_id` | satt, `hothash` null | Tekst-element |

En DB CHECK-constraint sikrer at nøyaktig ett av `hothash`/`text_item_id` er satt.

**Kolonnene på `collection_items`:**

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | UUID | Primærnøkkel — stabil selv om bildet slettes |
| `collection_id` | UUID FK | Hvilken collection |
| `hothash` | TEXT FK (nullable) | Referanse til photo |
| `text_item_id` | UUID FK (nullable) | Referanse til text_item |
| `position` | INT | Rekkefølge i collection |
| `caption` | TEXT nullable | Bildetekst — vises under bildet i visningsmodus |
| `notes` | TEXT nullable | Forelesningsnotater — kun i visningsmodus (skjult for publikum) |

Feltene `card_type`, `title`, `text_content`, `card_data` fjernes.

---

### `text_items`-tabellen

Tekstinnhold bor i sin egen tabell, analogt med `photos`:

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | UUID | Primærnøkkel |
| `markup` | TEXT | Markdown (CommonMark) |
| `created_at` | TIMESTAMPTZ | Opprettelsestidspunkt |

**Deling:** Et `text_item` kan refereres av flere `collection_items` (1:N). Kloning av en collection kopierer `text_item`-rader dypt — ikke deling på tvers av collections.

**Livsyklus:** Implisitt opprydding — slett `text_item` når ingen `collection_items` lenger refererer til det.

---

### `notes` — forelesningsnotater

`notes TEXT NULL` på `CollectionItem`:

- Lagres i DB — synkroniseres mellom maskiner med databasen
- Vises i Visningsmodus som et togglbart notatpanel (tastatursnarvei `N`)
- I HTML-eksport: skjult som standard, men inkludert i HTML og kan vises med `N` under fremføring
- Vises aldri i CollectionView-grid eller andre visninger

---

## Datamodell — oppsummert

Etter migreringen ser item-radene slik ut:

| hothash | text_item_id | caption | notes |
|---------|--------------|---------|-------|
| `abc123`| —            | "Drøbak havn, 1987" | "Kontekst: dette ble..." |
| —       | `uuid-1`     | —       | "Husk å fortelle om..." |

`text_item`-rad for `uuid-1`:

| id | markup | created_at |
|----|--------|------------|
| `uuid-1` | `# Kapittel 2\n\nVi reiste nordover...` | 2026-02-27T… |

---

## Tekstkort-formatering

`markup` er **Markdown** (CommonMark). Begrunnelse:

- Støtter titler (`# Tittel`), avsnitt, kursiv, lister
- Sentrering håndteres av CSS i renderer — ikke markup-syntaks
- Én parser (f.eks. `marked` eller `react-markdown`) dekker alle formateringsbehov
- DB-feltet er uendret hvis renderer byttes ut

`caption` er alltid ren tekst (én linje).

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
  markup: string
  notes: string | null
  collection_item_id: string
}

type Slide = PhotoSlide | TextSlide
```

`SlidePresenter` tar `Slide[]` og `currentIndex`. Switcher på `kind` for å rende riktig komponent. Ingenting annet.

---

## Kloning

`POST /collections/{id}/clone` oppretter en ny selvstendig collection:

- **Metadata:** Nytt navn (standard: `«Navn» (kopi)`), ny UUID, ny `created_at`
- **Foto-elementer:** Deler `hothash` — ingen kopiering
- **Tekst-elementer:** Dype kopier — nye `text_item`-rader med identisk `markup`
- **`caption` og `notes`:** Kopieres til nye `collection_item`-rader
- **Rekkefølge:** Bevares

Brukstilfelle: lage en kortere versjon av en presentasjon uten å miste originalen.

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
│         [Markdown rendret, sentrert via CSS]     │
│                                                  │
│   [prose, grå, maks 65 tegn bredde,              │
│    sentrert vertikalt på siden]                  │
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
  TextSlideView.tsx           ← Markdown-rendret tekstkort
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

`index.html` er en selvstendig nettside som kjører lysbildevisning offline. Tekstkort rendres som HTML-slides. Notater inkludert men skjult (toggle med `N`).

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

## Hva som ikke besluttes nå

| Funksjon | Kommentar |
|----------|-----------|
| Per-collection fargetema | `theme TEXT` på Collection — legg til ved behov |
| Overgangseeffekter | CSS — ingen DB-endring |
| Auto-play med timing | `display_duration_ms INT` på CollectionItem — legg til ved behov |
| To-skjerm presenter-modus | WebSocket-synkronisering — avansert, fremtidig |
| Full-oppløsning eksport | Frontend henter fra lokal disk (Electron), kombinerer med ZIP fra backend |

---

## Beslutningsoversikt

| # | Beslutning | Status |
|---|------------|--------|
| 1 | CollectionItem: to typer (foto/tekst) fryses — ingen `card_type`-streng | Besluttet |
| 2 | Tekst bor i egen `text_items`-tabell med `markup TEXT` (Markdown) | Besluttet — implementeres nå |
| 3 | Discriminator: `hothash IS NOT NULL` vs `text_item_id IS NOT NULL` med CHECK constraint | Besluttet |
| 4 | `caption TEXT NULL` og `notes TEXT NULL` beholdes på CollectionItem | Besluttet |
| 5 | TextItem deles 1:N; kloning lager dype kopier per collection | Besluttet |
| 6 | `POST /collections/{id}/clone` — kloner collection | Besluttet — implementeres nå |
| 7 | Tekstkort-formatering: Markdown (CommonMark), sentrering via CSS i renderer | Besluttet |
| 8 | Visningsmodus som dedikert siderute | Implementeres ved Visningsmodus |
| 9 | `SlidePresenter` delt for collection + event | Implementeres ved Visningsmodus |
| 10 | Slide-navigasjon: URL-param + replaceState | Implementeres ved Visningsmodus |
| 11 | Forelesningsnotater toggle (`N`) | Implementeres ved Visningsmodus |
| 12 | Fullskjerm via Fullscreen API | Implementeres ved Visningsmodus |
| 13 | HTML-eksport | Fremtidig |
| 14 | Full-oppløsning eksport via Electron | Fremtidig |
