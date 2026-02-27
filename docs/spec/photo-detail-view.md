# PhotoDetailView — spesifikasjon og analyse

Rute: `/photos/:hothash`

---

## Nåværende tilstand

To-panel layout. Henter `PhotoDetail` via `GET /photos/{hothash}`.

```
┌─────────────────────────────────────────────────┐
│ ← Tilbake                                        │
├──────────────────────────┬──────────────────────┤
│                          │ [filnavn fra master]  │
│                          │ Tidspunkt             │
│    coldpreview           │ Kamera                │
│    object-contain        │ Eksponering           │
│    full høyde            │ Brennvidde            │
│                          │ Tags                  │
│                          │ Filer (ImageFile)     │
└──────────────────────────┴──────────────────────┘
```

**Implementerte komponenter:**

| Fil | Ansvar |
|---|---|
| `src/pages/PhotoDetailPage.tsx` | Datahenting (React Query), layout-skjelett, nav-logikk |
| `src/features/photos/PhotoMetaPanel.tsx` | Metadata-panel (statisk visning) |

**Datagrunnlag:** `PhotoDetail` utvider `PhotoListItem` med `exif_data`, `image_files[]`, `correction`, `registered_at`.

**Coldpreview:** Serveres som JPEG direkte fra `GET /photos/{hothash}/coldpreview` (eget endepunkt, ikke base64). Håndterer korrigert vs. original automatisk i backend.

---

## Mangler i nåværende implementasjon

Følgende er spesifisert i `frontend.md` og `context-menu.md`, men ikke implementert:

- Forrige/neste-navigasjon
- Counter (3 av 47)
- Rating (redigerbar)
- Tags (redigerbar)
- Filmmaker / kontaktarkrad
- Korreksjonspanel (rotasjon, eksponering, crop)
- "Åpne original i eksternt program"
- Advarsel ved manglende originalfil
- Tastaturnavigasjon (← →)

---

## Navigasjonskontekst — problemet

Forrige/neste er ikke en triviell funksjon. Spørsmålet er: **forrige/neste i hvilken kontekst?**

Eksempel: Bruker filtrerer BrowseView på `tag:natur`, sortert etter dato. Åpner et bilde. Trykker neste. Bør neste være:

- (A) Neste bilde blant alle bilder i databasen
- (B) Neste bilde i det filtrerte utvalget brukeren kom fra
- (C) Neste bilde i den urlenkede spørringen

Alle tre er rimelige. Valget er en brukeropplevelsesavgjørelse.

### Kontekst-dimensjonene

Et "navigasjonsrom" defineres av tre akser:

| Dimensjon | Eksempler |
|---|---|
| **Kilde** | Alle photos, Event X, Collection Y, Fotograf Z, Søk |
| **Filter** | tags, rating, dato, kategori |
| **Sortering** | taken_at_desc, rating_desc, filename_asc |

En sekvens er én kombinasjon av disse tre. Kontekstproblemet er: *hvilken sekvens gjelder i detaljvisningen?*

---

## Tre navigasjonsstrategier

### Strategi S — Session (Zustand)

`orderedHashes: string[]` lagres i en Zustand-store (`useDetailNavStore`) når brukeren navigerer til detaljvisningen fra BrowseView. Forrige/neste beregnes som `orderedHashes[currentIndex ± 1]`.

```
BrowseView (orderedHashes = [...])
    ↓  bruker dobbeltklikker / velger "Åpne"
useDetailNavStore.setNavContext(orderedHashes, '/browse')
    ↓
navigate('/photos/:hothash')
    ↓
PhotoDetailPage leser orderedHashes, finner currentIndex
```

**Fordeler:**
- Null ekstra API-kall
- Alltid synkron med det brukeren faktisk så
- Enkel implementasjon

**Ulemper:**
- Tapes ved refresh (ikke persistent)
- Virker ikke ved direktelenke til `/photos/:hothash`
- Kontekst fra én BrowseView-sesjon, ikke oppdatert hvis data endrer seg

**Fallback ved tom kontekst:** Vis forrige/neste-knapper som deaktivert, eller hent nabo-hashes fra backend (`GET /photos?limit=1&before_hothash=X`).

### Strategi G — Global (Database)

Forrige/neste hentes fra backend basert på `default_sort` i SystemSettings. To tilnærminger:

a) `GET /photos/{hothash}/prev` og `GET /photos/{hothash}/next` — egne API-kall
b) Hent hele listen med hashes i riktig sort-rekkefølge ved sidelasting

**Fordeler:**
- Fungerer alltid, uavhengig av hvordan siden ble åpnet
- Persistent mellom sesjoner

**Ulemper:**
- Ignorerer brukerens aktive filtrering
- Ekstra API-kall

### Strategi U — URL-kodet kontekst

Navigasjonsparametrene kodes inn i URL: `/photos/abc?sort=taken_at_desc&tags=natur&event_id=xyz`. Forrige/neste beregnes server-side.

**Fordeler:**
- Delerbar URL med bevart kontekst
- Persistent mellom sesjoner

**Ulemper:**
- Kompleks URL-håndtering
- Krever API-endepunkt for "nabo i spørring"
- Størst implementasjonskostnad

---

## Valgt strategi: S (Session/Zustand)

For den første implementasjonen brukes Strategi S. Begrunnelse:

1. Lavest kompleksitet — `orderedHashes` er allerede tilgjengelig i `PhotoGrid`
2. Mest naturlig brukeropplevelse i normal flyt (fra BrowseView)
3. Legger grunnlag som de andre strategiene kan bygge på

### `useDetailNavStore` — design

```typescript
interface DetailNavStore {
  orderedHashes: string[]     // Hashes i rekkefølge fra kilden (BrowseView e.l.)
  returnTo: string            // Rute å gå tilbake til, default '/'
  setNavContext: (hashes: string[], returnTo: string) => void
  clear: () => void
}
```

**Settes** i `PhotoThumbnail` ved navigasjon (dobbeltklikk / "Åpne" i kontekstmeny):
```typescript
setNavContext(orderedHashes, '/browse')
navigate(`/photos/${photo.hothash}`)
```

**Leses** i `PhotoDetailPage`:
```typescript
const { orderedHashes, returnTo } = useDetailNavStore()
const currentIndex = orderedHashes.indexOf(hothash!)
const prevHash = currentIndex > 0 ? orderedHashes[currentIndex - 1] : null
const nextHash = currentIndex < orderedHashes.length - 1 ? orderedHashes[currentIndex + 1] : null
```

Navigasjon til neste/forrige er `navigate('/photos/' + nextHash)` — React Query henter `PhotoDetail` for det nye hothash.

---

## Preferansearkitektur

Bruker S som standardstrategi er ikke nøytralt — det er et valg med konsekvenser. Noen brukere vil foretrekke:

- "Forrige/neste i det jeg filtrerte fram" (S — default)
- "Forrige/neste i alle bilder uansett" (G)

Valget bør derfor lagres som en brukerinnstilling.

### Hvor hører preferansen hjemme?

| Alternativ | Fordel | Ulempe |
|---|---|---|
| **`SystemSettings` i backend** | Synkroniseres mellom maskiner (via databasekopiering) | Krever migrasjonsendring + API-oppdatering |
| **`localStorage` / Zustand persist** | Ingen backendendring | Ikke synkronisert mellom maskiner |
| **Zustand (ikke-persistent)** | Enklest, midlertidig | Nullstilles ved refresh |

**Anbefaling:** Legg `detail_nav_strategy: 'session' | 'global'` i `SystemSettings` (backend). Begrunning: Hotprevue synkroniseres mellom maskiner ved å kopiere database + coldpreview-katalog. Da bør alle preferanser følge med. Feltet kan ha standardverdi `'session'` satt i migrasjonen.

### Settings-visning (implementeres når nav-funksjonen implementeres)

```
Navigasjon i detaljvisning
  ○ Forrige/neste i utvalget jeg kom fra (standard)
  ○ Forrige/neste blant alle bilder i databasen
```

### Implikasjon for koden

`PhotoDetailPage` bør ha én hook `useDetailNavigation(hothash)` som returnerer `{ prev, next, total, currentIndex }`. Hook-en leser `detail_nav_strategy` fra SystemSettings og delegerer til riktig kilde:

```typescript
function useDetailNavigation(hothash: string) {
  const strategy = useSettingsStore(s => s.detail_nav_strategy) // 'session' | 'global'
  // strategy === 'session': les fra useDetailNavStore
  // strategy === 'global':  hent fra backend (eller preloaded all-hashes)
  ...
}
```

Dette isolerer navigasjonslogikken fra layoutkomponenten. Sidepaneler, header og tastaturlytter kaller bare `useDetailNavigation` — de bryr seg ikke om hvilken strategi som er aktiv.

---

## Planlagte egenskaper

### Navigasjon (neste steg)

| Element | Posisjon | Funksjon |
|---|---|---|
| ← / → piltaster | Global lytter | Forrige / neste |
| Forrige-knapp | Header høyre | Naviger til `prevHash` |
| Neste-knapp | Header høyre | Naviger til `nextHash` |
| Counter `3 av 47` | Header | `currentIndex + 1` av `orderedHashes.length` |

### Metadata (redigerbare felt)

| Felt | Komponent | API |
|---|---|---|
| Rating | Stjernekomponent (1–5 + tøm) | `PATCH /photos/{hothash}` |
| Tags | Tag-chips med add/remove | `PATCH /photos/{hothash}` |
| Event | Dropdown | `PATCH /photos/{hothash}` |
| Dato (manuell) | Dato-input med kildeindikator | `PATCH /photos/{hothash}` |

### Visuelle utvidelser

| Element | Beskrivelse |
|---|---|
| Filmstrip | Rad med hotpreviews for naboer i kontekst, scrollbar |
| Fullskjerm | Klikk på coldpreview → fullskjerm (Escape avslutter) |
| Originalfil-advarsel | Ikon/banner hvis masterfilen ikke finnes på disk |
| Korreksjonspanel | Rotasjon, horisontjustering, eksponering, crop |

### Metadata-tabs (høyre panel)

Høyre panel bør støtte tabs (Radix UI Tabs) for å holde panelene separerte:

```
[Metadata] [EXIF] [Filer] [Korreksjon]
─────────────────────────────────────
Tidspunkt: …
Kamera: …
```

`exif_data` (rå JSONB fra backend) gir all data for EXIF-tabellen uten ekstra API-kall.

---

## Komponentarkitektur

Prinsipp: `PhotoDetailPage` er et tynt skjelett. Den henter data og monterer paneler. Panelene er rene `({ photo }) => JSX`-komponenter uten egne datakall.

```
pages/
  PhotoDetailPage.tsx          ← React Query, layout, Escape/pil-lytter
features/photos/
  PhotoDetailHeader.tsx        ← ← Tilbake, filnavn, prev/next, counter
  PhotoImageViewer.tsx         ← Coldpreview (object-contain, klikk→fullskjerm)
  PhotoMetaPanel.tsx           ← Eksisterende: dato, kamera, eksponering (eksisterer)
  PhotoExifPanel.tsx           ← Rå EXIF-tabell (fremtidig)
  PhotoFilesPanel.tsx          ← ImageFile-liste med sti og advarsel (fremtidig)
  PhotoCorrectionPanel.tsx     ← Korreksjonspanel (fremtidig)
stores/
  useDetailNavStore.ts         ← orderedHashes, returnTo, setNavContext (neste)
hooks/
  useDetailNavigation.ts       ← useDetailNavStore + strategi-abstraksjon (fremtidig)
```

Layoutskjelettet i `PhotoDetailPage` er bevisst tynt:

```tsx
<div className="flex flex-col h-screen ...">
  <PhotoDetailHeader photo={photo} prev={prevHash} next={nextHash} ... />
  <div className="flex flex-1 min-h-0">
    <PhotoImageViewer photo={photo} />
    <div className="flex-[2] overflow-y-auto ...">
      <Tabs.Root>
        <Tabs.List>
          <Tabs.Trigger>Metadata</Tabs.Trigger>
          {/* ... */}
        </Tabs.List>
        <Tabs.Content value="metadata"><PhotoMetaPanel photo={photo} /></Tabs.Content>
        {/* ... */}
      </Tabs.Root>
    </div>
  </div>
</div>
```

Å legge til et nytt panel er å legge til én `Tabs.Content`-blokk og én ny komponentfil — ingenting annet endres.

---

## Neste implementasjonssteg

I prioritert rekkefølge:

1. **`useDetailNavStore`** — sett kontekst fra `PhotoThumbnail`, les i `PhotoDetailPage`
2. **`PhotoDetailHeader`** — forrige/neste-knapper, counter, ← Tilbake (erstatter nåværende inline header)
3. **Tastaturlytter** — ← → i `PhotoDetailPage`, Escape til `returnTo`
4. **Tabs på høyre panel** — Radix UI Tabs, `PhotoMetaPanel` som første tab
5. **`detail_nav_strategy` i `SystemSettings`** — backend-migrering + `GET/PATCH /settings` + Settings-side (implementeres samtidig med nav-funksjonen, ikke etterpå)
6. **`useDetailNavigation`-hook** — strategi-abstraksjon
