# Frontend-spesifikasjon

## Teknologistack

| Teknologi | Rolle |
|---|---|
| **React 18** | UI-rammeverk |
| **TypeScript** | Typesikkerhet — all kode er typet |
| **Tailwind CSS** | Styling — ingen separate CSS-filer |
| **Vite** | Bygging og utvikling |
| **React Query (TanStack Query)** | Server-state: caching, loading, feil mot API |
| **Zustand** | Klient-state: utvalg, visningsvalg, midlertidige tilstander |
| **Radix UI** | Headless UI-primitiver for komplekse komponenter (modal, dropdown, tabs) |
| **React Router (HashRouter)** | Klientside-routing |

---

## Arkitekturprinsipper

Disse prinsippene gjelder alltid og styrer alle kodebeslutninger:

### 1. Små, fokuserte filer
Maks ~100 linjer per komponentfil. Del opp aggressivt. Store filer er der feil introduseres og kontekst går tapt.

### 2. Typed API-klientlag
Alle backend-kall går gjennom `src/api/`. Ingen `fetch()` direkte i komponenter. Hvert endepunkt har en typet funksjon som returnerer et kjent TypeScript-objekt. `agentClient.ts`/`agent.ts` går mot den lokale agenten (port 8002), resten mot backend.

### 3. Ingen CSS-filer
All styling skjer med Tailwind utility-klasser inline i JSX.

### 4. Radix UI for komplekse komponenter
Modaler, dropdowns, tooltips, tabs og andre interaktive komponenter bygges på Radix UI-primitiver — tilgjengelighet og tastaturnavigasjon følger med gratis.

### 5. Typer i egne filer
Alle API- og domenetyper ligger i `src/types/api.ts` — énkildes sannhet. Aldri domenetyper inline i komponentfiler.

### 6. React Query for all server-state
Ingen lokal `useState` for data som kommer fra API. Mutation-hooks invaliderer relevante queries.

### 7. Zustand for klient-state
Én store per ansvar (se tabell under). Visningsvalg persisteres til `localStorage` der brukeren forventer at de huskes.

---

## Mappestruktur

```
frontend/src/
  api/           Thin fetch-wrappers, én fil per ressurs
  types/api.ts   Alle TypeScript-typer
  stores/        Zustand — kun global UI-tilstand
  hooks/         usePhotoSource, useScrollRestoration, useBrowse, useAiSearch,
                 useImageZoom, useIsMobile, useEnsureMachine
  components/    Generelle komponenter: TopNav, ViewToggle, ContextMenuOverlay
    ui/          Gjenbrukbare primitiver (NavDropdown, ThumbnailShell, …)
  features/      Domenemapper: browse/, collection/, events/, search/,
                 selection/, assignment/, registration/, preorganisering/,
                 present/, photos/, stacks/, tags/, kinds/, identity/,
                 location/, photographers/, home/, settings/, setup/, timeline/
  pages/         Route-komponenter — tynne, delegerer til features/
  lib/           Formatering, hjelpere, konstanter
```

## Ruter (HashRouter)

| Rute | Side | Merknad |
|---|---|---|
| `/` | HomePage | Statistikk, snarveier, bildemosaikk |
| `/browse` | BrowsePage | `?session_id=` / `?event_id=` / `?taken_from=&taken_to=` |
| `/timeline` | TimelinePage | Grid-/tre-/zoom-visning (ADR-033) |
| `/photos/:hothash` | PhotoDetailPage | Uten scroll-container; egen Escape-håndtering |
| `/collections` `/collections/:id` | Kolleksjoner | |
| `/collections/:id/present` | CollectionPresentPage | Uten AppLayout |
| `/sessions` | SessionsListPage | Passiv oversikt over registreringer |
| `/events` `/events/:id` | Events | |
| `/searches` `/searches/new` `/searches/:id` | Lagrede søk / søkeside | |
| `/ai-search` | AiSearchPage | Semantisk søk (ADR-022) |
| `/settings` | SettingsPage | |
| `/sted` | LocationEditorPage | Kartredigering av posisjon |
| `/fotografer` | PhotographersPage | |
| `/maskiner` | MachinesPage | |
| `/kinds` `/tags` | Forvaltning | |
| `/preorganisering` | PreorganiseringPage | Lokale verktøy — krever agent |
| `/register` | RegisterPage | Registreringsflyt — krever agent; uten AppLayout |
| `/share/photo/:hothash` | SharedPhotoPage | Offentlig visning; uten AppLayout |

TopNav grupperer rutene: tre primærlenker (Tidslinje/Events/Kolleksjoner), nedtrekksgrupper for Søk og Organisering, Sesjoner som vanlig lenke, og et visuelt dempet «uploader»-cluster (Registrer / Lokale verktøy) som krever agenten.

## Zustand-stores

| Store | Tilstand |
|---|---|
| `useSelectionStore` | `selected: Set<hothash>`, `anchor` — avkryssingstilstand |
| `usePhotoNavStore` | `gridOrder` (synlig rekkefølge), `hothashes` (bla-liste for detaljside), `backUrl` |
| `useContextMenuStore` | Global kontekstmeny (items + posisjon) |
| `useAssignmentStore` | Hvilken picker-modal er åpen (`event`/`collection`) |
| `useSessionStore` | Aktiv fotografidentitet (persisted, ADR-012) |
| `useViewStore` | `gridVariant`, `stacksCollapsed`, `timelineView`, `browseView` (persisted) |
| `useKindFilterStore` | Valgte kinds (persisted) — KindFilterBar viser rav-merke når noe er skjult |
| `useTagSetStore`, `useTimelineStore`, `useLocationEditorStore` | Øvrige persisted UI-valg |
| `useToastStore`, `usePreorganiserStore` | Flyktig tilstand |

## Navigasjons- og tastaturkonvensjoner

- **Escape-kjede:** global handler i App.tsx lukker kontekstmeny først, deretter tømmes utvalget. Sider med egen Escape-håndtering (PhotoDetailPage) registrerer lytter med `{ capture: true }` og kaller `e.preventDefault()` — App-handleren respekterer `defaultPrevented`.
- **Scroll-restaurering:** all scrolling skjer i AppLayouts container. `useScrollRestoration` lagrer posisjon per `location.key` og gjenoppretter ved tilbakenavigasjon (rAF-polling til async innhold har høyde).
- **Tilbake fra detaljside:** `navigate(-1)` når historikken har oppføringer (bevarer scrollposisjon), ellers `backUrl` fra `usePhotoNavStore`. Forrige/neste bruker `replace: true` slik at hele bildevandringen er én historikkoppføring.
- **Åpne bilde fra grid:** dobbeltklikk eller kontekstmeny setter bla-kontekst (hothashes + backUrl) før navigering.

## Utvalgsmodell (Windows Explorer-mønster)

| Handling | Resultat |
|---|---|
| Klikk | Velg kun dette |
| Ctrl+klikk | Toggle dette — behold resten |
| Shift+klikk | Velg rekke fra anker |
| Ctrl+A | Velg alle i gjeldende utvalg |
| Escape | Lukk meny → tøm utvalg (se Escape-kjeden) |

Anker lagres i `useSelectionStore`; rekkeberegning bruker `gridOrder` fra `usePhotoNavStore`. Valgt bilde vises med ramme + hake; SelectionTray (bunnoverlegg) vises når utvalget er ikke-tomt og tilbyr batch-handlinger.

## Tildelingsflyt (ADR-014)

1. Velg bilder i PhotoGrid (avkryssingstilstand)
2. Høyreklikk → batch-kontekstmeny, eller SelectionTray → «Registrer på»
3. PickerModal (event/collection) åpnes via `useAssignmentStore`
4. Modalen kaller batch-API

Se `photo-assignment.md`, `context-menu.md` og `selection-tray.md`.

## Lasting og ytelse

- `usePhotoSource` er den universelle datahooken (PhotoGrid, PhotoTimeline, SearchPage): `useInfiniteQuery`-basert paginering med `loadMore`/`infiniteScroll`.
- `PhotoThumbnail` er memoisert og abonnerer kun på sitt eget valgt-flagg; alt annet leses lazily via `getState()` i handlere. Gridet kan inneholde tusenvis av bilder.
- Virtualisering (TanStack Virtual) er en mulig senere optimering — ingen arkitekturendring kreves.

## To verdener

| BrowseView | CollectionView |
|---|---|
| Uordnet spørringsresultat | Ordnet, kuratert |
| Avkryssingstilstand + batch-operasjoner | Ingen avkryssing; presentasjonsoperatorer |
| Kilde for tildeling | **Aldri kilde** — sluttprodukt |
| `PhotoGrid` / `PhotoTimeline` | `CollectionGrid` |

Se `domain.md` for full begrunnelse.
