# Frontend-spesifikasjon

## Teknologistack

| Teknologi | Rolle |
|---|---|
| **React 18** | UI-rammeverk |
| **TypeScript** | Typesikkerhet — all kode er typet |
| **Tailwind CSS** | Styling — ingen separate CSS-filer |
| **Vite** | Bygging og utvikling |
| **React Query (TanStack Query)** | Server-state: caching, loading, feil mot API |
| **Zustand** | Klient-state: valgte photos, modus, midlertidige tilstander |
| **Radix UI** | Headless UI-primitiver for komplekse komponenter (modal, dropdown, tabs) |
| **React Router** | Klientside-routing |
| **electron-vite** | Electron-wrapper for desktop (valgfritt — kan kjøres som ren webapp) |

---

## Arkitekturprinsipper

Disse prinsippene gjelder alltid og styrer alle kodebeslutninger:

### 1. Små, fokuserte filer
Maks ~100 linjer per komponentfil. Del opp aggressivt. Store filer er der feil introduseres og kontekst går tapt.

### 2. Typed API-klientlag
Alle backend-kall går gjennom `src/api/`. Ingen `fetch()` direkte i komponenter. Hvert endepunkt har en typet funksjon som returnerer et kjent TypeScript-objekt. Hvis API-typene er riktige, propagerer TypeScript feil i stedet for å la dem passere stille.

### 3. Ingen CSS-filer
All styling skjer med Tailwind utility-klasser inline i JSX. Ingen `.css`- eller `.module.css`-filer. Globale Tailwind-innstillinger konfigureres i `tailwind.config.ts`.

### 4. Radix UI for komplekse komponenter
Modaler, dropdowns, tooltips, tabs og andre interaktive komponenter bygges på Radix UI-primitiver. AI trenger kun å sette Tailwind-klasser, ikke implementere tilgjengelighet og tastaturnavigasjon fra bunnen.

### 5. Typer i egne filer
TypeScript-typer som matcher API-responser og domeneobjekter samles i `src/types/`. Importeres i komponenter og API-klientfunksjoner. Endres aldri lokalt i komponentfiler.

### 6. React Query for all server-state
Data fra backend håndteres utelukkende via React Query. Ingen lokal useState for data som kommer fra API. Mutation-hooks wrapper PATCH/POST/DELETE-kall og invaliderer relevante queries automatisk.

### 7. Zustand for klient-state
Tilstander som ikke er server-data (flervalgsmodus, valgte photos, aktive filtre, midlertidig sortering) håndteres i Zustand-stores. En store per domene.

---

## Mappestruktur

```
frontend/
  src/
    api/              # Typed API-klientfunksjoner, én fil per ressurs
      photos.ts
      events.ts
      collections.ts
      ...
    types/            # TypeScript-typer for API-responser og domene
      photo.ts
      event.ts
      ...
    components/
      ui/             # Radix UI-wrappers med Tailwind-styling
        Button.tsx
        Dialog.tsx
        DropdownMenu.tsx
        ...
    features/         # Funksjonalitet organisert etter domene
      gallery/
      photos/
      events/
      collections/
      stacks/
      input-sessions/
      photographers/
      duplicates/
      settings/
      admin/
    hooks/            # Gjenbrukbare React-hooks
    stores/           # Zustand-stores
    pages/            # Rutekomponenter — tynne, komponerer features
    lib/              # Formatering, datohjelpere, konstanter
```

---

## Ruter

| Rute | Side |
|---|---|
| `/` | Hovedgalleri / timeline |
| `/photos/:hothash` | Detaljvisning for ett photo |
| `/events` | Liste over events som trestruktur |
| `/events/:id` | Event med tilhørende photos |
| `/collections` | Liste over collections |
| `/collections/:id` | Collection i rekkefølge |
| `/stacks/:stack_id` | Alle photos i en stack |
| `/input-sessions` | Registreringsassistent — liste og opprettelse |
| `/input-sessions/:id` | Pågående eller fullført sesjon |
| `/photographers` | Liste over fotografer |
| `/photographers/:id` | Fotograf med tilhørende photos |
| `/duplicates` | Oversikt over duplikatfiler |
| `/search` | Søk og filtrering |
| `/settings` | Systeminnstillinger |
| `/admin` | Systemstatus og filstivalidering |

---

## Visninger

### Galleri / timeline
- Grid-visning av hotpreviews
- Stacks vises som ett photo (coverbilde) med indikator for antall
- Mykt slettede photos vises med slettet-indikator hvis `show_deleted_in_gallery` er på
- Lazy loading og paginering
- Filtrering på fotograf, event, tags, rating, dato, kategori
- Sortering (følger `default_sort` fra settings, kan overstyres midlertidig)
- Flervalgsmodus for batch-operasjoner

### Detaljvisning
- Coldpreview (korrigert versjon hvis korreksjon finnes, ellers original)
- Alle metadata: EXIF, tags, rating, event, fotograf, kategori
- Korreksjonsverktøy: rotasjon, horisont, eksponering, crop
- Liste over tilknyttede ImageFiles med filtype og sti
- Knapp for å åpne originalfil i eksternt program
- Navigasjon til forrige/neste photo i gjeldende kontekst
- Tydelig varsling hvis originalfil ikke er tilgjengelig på disk

### Registreringsassistent
- Steg 1: Opprett sesjon — navn, fotograf, kildekatalog, event (valgfritt)
- Steg 2: Skann — vis gruppesammendrag (RAW+JPEG-par, kun RAW, kun JPEG, duplikater, feil)
- Steg 3: Bekreft — brukeren godkjenner before prosessering starter
- Steg 4: Fremgang — live-oppdatering under registrering
- Steg 5: Oppsummering — antall registrerte, duplikater og feil

### Settings
- Visningsinnstillinger: standardsortering, vis slettede i galleri
- Coldpreview-innstillinger: maks piksler (langside), JPEG-kvalitet
- Eierinfo: instansnavn, eiers navn, nettside, bio
- Installasjons-ID: vises som read-only

### Admin
- Filstivalidering: status per ImageFile (ok / mangler / endret)
- Batch-oppdatering av stiprefikser (f.eks. ved flytting av ekstern disk)
- Oversikt over input-sesjoner
- Systeminfo: databasestørrelse, antall photos, coldpreview-diskbruk

---

## UX-prinsipper

- Originalfilsti alltid synlig i detaljvisning
- Tydelig varsling når originalfil ikke er tilgjengelig
- Ingen destruktive operasjoner uten bekreftelse (dialog)
- Batch-operasjoner (tags, rating, event, kategori, fotograf) støttes i gallerivisning via flervalgsmodus
- Standardverdier fra settings respekteres som innledende tilstand; brukeren kan overstyre i sesjonen
