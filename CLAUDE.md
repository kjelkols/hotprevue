# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hotprevue** is a photo management system for organizing, viewing, and accessing large image collections. It indexes images without moving or altering original files — only metadata is stored. The system is single-user with no authentication.

## Architecture

Two separate components with clearly defined responsibilities:

**Client** (locally installed on the user's machine):
- Python process + React UI in browser — same distribution format as before (zip + uv binary)
- Reads local image files directly from disk
- Extracts EXIF, generates hotpreview (150×150), computes hothash, generates coldpreview (max 1200px)
- Sends processed results to backend API — never writes to database or disk itself
- Serves React UI on localhost

**Backend** (local or on a server):
- FastAPI (Python), SQLAlchemy (sync, psycopg2), Alembic for migrations
- Pure API server — never reads original image files
- Stores metadata in PostgreSQL, stores coldpreviews on disk, serves coldpreviews via HTTP
- Structure: `api/`, `core/`, `database/`, `models/`, `schemas/`, `services/`, `utils/`

**Frontend** (React app, served by the client):
- React 18 + TypeScript + Tailwind CSS + Vite
- State: React Query (server), Zustand (client). UI primitives: Radix UI
- Structure: `src/api/`, `src/types/`, `src/components/ui/`, `src/features/`, `src/pages/`, `src/stores/`, `src/hooks/`, `src/lib/`

**Tests:** `backend/tests/` — pytest-based.

**Database:** pgserver (embedded PostgreSQL) for local installs. `HOTPREVUE_SERVER=local` activates local mode. External PostgreSQL for server installs. See ADR-009.

## Backend is Synchronous

**Never use async in backend code.** Hotprevue is a single-user system — async adds complexity with zero benefit. Pillow (image processing) is synchronous anyway.

- Route handlers: `def`, never `async def`
- Database session: `Session`, never `AsyncSession`
- Engine: `create_engine`, never `create_async_engine`
- Driver: `psycopg2-binary`, never `asyncpg`
- No `await` anywhere in backend code
- Tests: `TestClient`, never `AsyncClient` or `pytest-asyncio`

## Frontend — nåværende arkitektur (oppdatert)

### Katalogkart

```
src/
  api/           Thin fetch-wrappers, én fil per ressurs (photos.ts, events.ts, …)
                 agentClient.ts/agent.ts går mot lokal agent (port 8002), resten mot backend
  stores/        Zustand — kun global UI-tilstand (se tabell under)
  hooks/         usePhotoSource (universell bildehenting), useScrollRestoration,
                 useBrowse, useAiSearch, useImageZoom, useIsMobile, useEnsureMachine
  features/      Domenemapper:
    assignment/    EventPickerModal, CollectionPickerModal, AssignButton
    browse/        PhotoGrid, PhotoThumbnail (memoisert), PhotoTimeline, QuickView
    collection/    CollectionGrid, CollectionItemCell, TextCard
    events/ home/ identity/ kinds/ location/ photographers/ photos/ stacks/ tags/
    preorganisering/  Lokale verktøy (krever agent)
    search/        SearchCriteriaBuilder, TimelineDayNode, …
    selection/     SelectionTray, SelectionModal, SelectionThumbnail
    registration/  RegistrationFlow og steg (krever agent)
    present/       SlidePresenter og visninger
    settings/ setup/ timeline/
  components/    Generelle UI-komponenter: TopNav, ViewToggle, ContextMenuOverlay
  pages/         Route-komponenter (tynne, delegerer til features/)
  types/api.ts   Alle TypeScript-typer — énkildes sannhet
```

### Zustand-stores

| Fil | Tilstand | Nøkkelmetoder |
|-----|----------|---------------|
| `useSelectionStore` | `selected: Set<string>` (hothashes), `anchor` | `selectOnly`, `toggleOne`, `selectRange`, `selectAll`, `clear` |
| `useContextMenuStore` | `open`, `position`, `items` | `openContextMenu({items, position})`, `closeContextMenu()` |
| `useAssignmentStore` | `modal: 'event'\|'collection'\|null` | `open(modal)`, `close()` |
| `usePhotoNavStore` | `gridOrder` (synlig grid-rekkefølge), `hothashes` (bla-liste for detaljside), `backUrl` | `setGridOrder`, `setHothashes`, `setBackUrl` |
| `useSessionStore` | Aktiv fotografidentitet (persisted) | — |
| `useViewStore` | `gridVariant`, `stacksCollapsed`, `timelineView`, `browseView` (alle persisted) | `set*`-metoder |
| `useKindFilterStore` | `selectedKindIds` (persisted!) — KindFilterBar viser rav-merke når kinds er skjult | `toggle`, `setAll`, `initFromKinds` |
| `useTagSetStore` | Tag-utvalg (persisted) | — |
| `useTimelineStore` | Zoom-tidslinje: `pxPerDay`, `topMs` (persisted) | — |
| `useToastStore` | Toast-meldinger | — |
| `usePreorganiserStore` | Lokale verktøy-state | — |
| `useLocationEditorStore` | Kart-editorstate (persisted) | — |

### Globale overlays (montert i App.tsx, utenfor Routes)

```tsx
<ContextMenuOverlay />   // renderer useContextMenuStore.items
<SelectionTray />        // vises når selected.size > 0
<EventPickerModal />     // åpner når modal === 'event'
<CollectionPickerModal />
```

### Navigasjons- og tastaturkonvensjoner

- **Escape-kjede:** global handler i App.tsx lukker kontekstmeny først, deretter
  tømmes utvalget. Sider som selv håndterer Escape (PhotoDetailPage navigerer
  tilbake) registrerer lytteren med `{ capture: true }` og kaller
  `e.preventDefault()` — App-handleren respekterer `defaultPrevented`.
- **Scroll-restaurering:** all scrolling skjer i AppLayouts container (aldri i
  vinduet). `useScrollRestoration` lagrer posisjon per `location.key` og
  gjenoppretter ved tilbakenavigasjon (rAF-polling til async innhold har høyde).
- **Tilbake fra detaljside:** `navigate(-1)` når historikken har oppføringer
  (bevarer scrollposisjon), ellers fallback til `backUrl` fra usePhotoNavStore.
  Forrige/neste-blaing bruker `navigate(..., { replace: true })` slik at hele
  bildevandringen er én historikkoppføring.
- **Åpne bilde fra grid:** dobbeltklikk eller kontekstmeny → `openPhoto()` i
  PhotoThumbnail setter bla-kontekst (hothashes + backUrl) før navigering.

### Kontekstmeny-mønster

```ts
const { openContextMenu } = useContextMenuStore()
openContextMenu({
  position: { x: e.clientX, y: e.clientY },
  items: [
    { id: 'foo', label: 'Handling', action: () => … },
    { type: 'separator' },
    { id: 'bar', label: 'Standard', action: () => …, isDefault: true },
  ],
})
```

### Tildelingsflyt (ADR-014)

Ingen global navigasjonstilstand. `useNavigationStore` og `SourceTargetPanel` er slettet.

1. Velg bilder (checkboxes i PhotoGrid, lagres i `useSelectionStore`)
2. Høyreklikk → batch-kontekstmeny **eller** SelectionTray → AssignButton ("Registrer på")
3. PickerModal åpner (via `useAssignmentStore.open(modal)`)
4. Modal henter liste, bruker velger mål, kaller batch-API

Batch-API i `api/photos.ts`: `assignEvent`, `batchRating`, `batchPhotographer`, `batchDelete`.
Collection-batch: `addCollectionItemsBatch` i `api/collections.ts`.

### To verdener

| BrowseView | CollectionView |
|------------|----------------|
| Uordnet | Ordnet |
| Avkryssingstilstand (SelectionStore) | Ingen avkryssing |
| Metadata-operatorer | Presentasjonsoperatorer (rekkefølge, tekstkort) |
| Kilde for tildeling | **Aldri kilde** — sluttprodukt |
| `PhotoGrid` / `PhotoTimeline` | `CollectionGrid` |

### Ruter (HashRouter — se App.tsx)

```
/                       HomePage
/browse                 BrowsePage  (?session_id= / ?event_id= / ?taken_from=&taken_to=)
/timeline               TimelinePage  (grid/tre/zoom-visning)
/photos/:hothash        PhotoDetailPage
/collections            CollectionsListPage
/collections/:id        CollectionPage
/collections/:id/present  CollectionPresentPage   (ingen AppLayout)
/sessions               SessionsListPage
/events / /events/:id   EventsListPage / EventPage
/searches               SavedSearchesPage
/searches/new / /:id    SearchPage
/ai-search              AiSearchPage
/settings               SettingsPage
/sted                   LocationEditorPage
/fotografer             PhotographersPage
/maskiner               MachinesPage
/kinds                  KindsPage
/tags                   TagsPage
/preorganisering        PreorganiseringPage  (Lokale verktøy, krever agent)
/register               RegisterPage  (ingen AppLayout, krever agent)
/share/photo/:hothash   SharedPhotoPage  (ingen AppLayout)
```

### usePhotoSource

Universell datahook. Brukes av PhotoGrid, PhotoTimeline og SearchPage.

```ts
usePhotoSource({ sessionId?, eventId?, logic?, criteria?, enabled? })
// → { photos, isLoading, isError, hasMore, loadMore, isFetchingMore, infiniteScroll }
```

### Dev og deploy

```bash
bash scripts/dev-local.sh        # tmux: backend (8000) + agent (8002) + Vite (5173),
                                 # alle med hot reload rett fra arbeidstreet
bash scripts/dev-stop.sh         # stopp dev-oppsettet
bash scripts/deploy.sh user@host # tester + bygg + rsync til server (kjøres av brukeren)
```

---

## Frontend Coding Rules

These rules apply to all frontend code and exist to prevent AI formatting errors:

- **One component per file, max ~100 lines.** Split aggressively.
- **All API calls go through `src/api/`.** Never use `fetch()` directly in components.
- **No CSS files.** Tailwind utility classes only, inline in JSX.
- **Radix UI for complex interactive components** (modals, dropdowns, tabs). Do not build these from scratch.
- **TypeScript types in `src/types/`.** Never define domain types inline in component files.
- **React Query for all server state.** No `useState` for data that comes from the API.
- **Zustand for client-only state** (selection mode, active filters, etc.).

## Client Does File Processing

The client is a **local process** running on the user's machine with full filesystem access. The browser UI has no filesystem access — all file operations go through the local Python process.

The client (not the backend) owns all image processing:

```
Browser (React)       Local Python (client)         Backend API (local or remote)
      │                       │                              │
      │  "scan directory"     │                              │
      │ ───────────────────►  │  os.scandir(path)            │
      │                       │  read RAW files              │
      │                       │  extract EXIF                │
      │                       │  generate hotpreview         │
      │                       │  compute hothash             │
      │                       │  generate coldpreview        │
      │                       │                              │
      │                       │  POST /input-sessions/{id}/groups
      │                       │  { hothash, previews, exif } │
      │                       │ ────────────────────────────►│
      │                       │                              │  store in PostgreSQL
      │                       │                              │  save coldpreview to disk
```

**Rule:** The backend never reads original image files. All file processing happens client-side.

See `docs/decisions/008-client-server-split.md` for full rationale.

## Key Technical Decisions

- **"Register" not "import":** Never use the word "import" when referring to adding images to the system. The system *registers* image metadata, it does not import or move files.
- **No original file storage:** Only metadata and file paths are stored. Original files remain wherever the user keeps them.
- **Hotpreview:** 150×150px thumbnail, base64-encoded, stored in the database. SHA256 of hotpreview = `hothash` (used as unique image ID).
- **Coldpreview:** 800–1200px preview, stored on disk in a hash-based directory structure (e.g., `/data/coldpreviews/ab/cd/abcd1234...jpg`). Can always be regenerated from the original.
- **Base64 for all image binary data** in API responses.
- **API must listen on `0.0.0.0`** in dev (reachable via Tailscale), `127.0.0.1` in zip distribution.
- **Environment variables** for database URL and all configuration:
  - `HOTPREVUE_SERVER=local` — activates pgserver mode (embedded DB)
  - `DATA_DIR` — override data directory (default: `%APPDATA%\Hotprevue` / `~/.local/share/Hotprevue`)
  - `HOTPREVUE_FRONTEND_DIR` — directory to serve as static frontend
  - `HOTPREVUE_OPEN_BROWSER=true` — open browser automatically on startup
  - `HOTPREVUE_MACHINE_ID` — UUID of this machine (activates `_register_machine()` on startup)
  - `HOTPREVUE_PHOTOGRAPHER_ID` — UUID of the photographer to assign to this machine (used when creating a new machine row)

## Domain Concepts

- **Stack:** Multiple images of the same subject grouped together. One image is the `is_stack_cover`. Stack has no own metadata — it's purely a display aid. Implemented via `stack_id` on individual images.
- **Event:** Unordered group of images tied to a happening (one-to-many: each image belongs to at most one event). Supports parent-child hierarchy.
- **Collection:** Ordered group of images where order matters (many-to-many). Used for slideshows, portfolios, deliveries. Each image can have a caption; text cards can be interspersed.
- **Companion files:** Each image can have associated files (RAW, JPEG, XMP, sidecar), stored as a list with type and file path.
- **Register session:** Each registration run creates a session linked to the registered images.
- **Machine:** Each client installation is a registered machine (`machines` table). A machine has exactly one photographer (ADR-011). `photos.registered_by_machine_id` records which machine registered a photo (nullable — may be absent for older rows).
- **Session identity (web sessions):** When a browser accesses the backend without a Python client, the user selects their photographer identity from a list (ADR-012). Selection is persisted in `localStorage`. Stored in `useSessionStore` (Zustand). Write operations require a selected photographer.

## Development Commands

```sh
# Start backend
make dev-backend
# eller direkte:
cd backend && DATABASE_URL="postgresql+psycopg2:///hotprevue?host=/run/postgresql" uv run uvicorn main:app --host 0.0.0.0 --port 8000

# Start Vite dev-server med hot-reload (tilgjengelig på nettverket, åpne i nettleser):
make dev-frontend   # cd frontend && npm run dev:web  → http://<server-ip>:5173

# Kjør Alembic-migrasjoner (lokal PostgreSQL via Unix socket):
bash scripts/alembic-upgrade.sh

# Første gangs oppsett — opprett testdatabase (én gang per maskin):
createdb hotprevue_test

# Kjør tester (lokal PostgreSQL):
bash scripts/run-tests.sh
# eller én test:
bash scripts/run-tests.sh tests/api/test_photos.py::test_name

# Bygg frontend til statiske filer
make build-web
# eller: cd frontend && npm run build:web  → frontend/dist/
```

**Merk:** `--reload` fungerer ikke med lokal dev-oppsett (socket-problem med subprocess).

**Vite dev-server:** Proxyer automatisk alle API-kall til backend på port 8000.
Tilgjengelig på `0.0.0.0` slik at Windows-nettleser kan koble til via server-IP.

**Tkinter-dialogen** («Velg…»-knappen) fungerer bare i zip-distribusjonen der
brukeren har en skjerm. På en headless server brukes `/system/browse` i stedet.

## Bygge distribusjonspakker

```sh
make build-zip-windows   # Hotprevue-x.y.z-windows.zip
make build-zip-linux     # Hotprevue-x.y.z-linux.zip
make build-zip-all       # Begge

# Versjonsnummer hentes automatisk fra siste git-tag
```

Zip-pakkene inneholder: `backend/` (kildekode), `frontend/` (bygd), `uv`-binær,
startskript. Brukeren dobbeltklikker på `Hotprevue.bat` (Windows) eller
kjører `./hotprevue.sh` (Linux) — backend starter og nettleseren åpnes automatisk.

**Release til GitHub:** Push en tag — GitHub Actions bygger og publiserer automatisk:
```sh
git tag v0.2.0 && git push origin v0.2.0
```


## Machine API (ADR-011)

- `POST /machines` — register a new machine; body: `{ machine_name, photographer_id? }`. If `photographer_id` is omitted, auto-resolves to default/first photographer or creates an "Ukjent" photographer. Returns `MachineOut`.
- `GET /machines` — list all registered machines.
- `GET /machines/{machine_id}` — get one machine.

`GroupPayload` includes optional `machine_id` — client sends its machine UUID so backend can set `photos.registered_by_machine_id`. Also includes optional quality metrics (`sharpness_score`, `exposure_mean`, `exposure_clipping`, `noise_score`) computed from the original file during registration (ADR-021).

## Registration API Endpoints

- `POST /photos/check-hothashes` — session-independent duplicate check. Client sends `{ hothashes: string[] }`, backend returns `{ known: [], unknown: [] }`. Call this after hashing but before generating coldpreviews and before creating a session.
- `POST /input-sessions` — create a registration session (only after confirming there are new images).
- `POST /input-sessions/{id}/groups` — register one processed image group. Client sends hothash, previews (base64), EXIF, file metadata, optional `machine_id`, `event_id`, and quality metrics. Backend stores in DB and writes coldpreview to disk.
- `POST /input-sessions/{id}/complete` — finalise the session.
- `POST /system/folder-event-lookup` — given `{ paths: string[] }`, returns `{ matches: [{ path, event: { id, name } | null }] }`. Used by StepFolderMap to detect which subdirectories are already associated with an event.

**Removed:** `/system/pick-directory`, `/system/scan-directory`, `/system/browse`, `/input-sessions/{id}/groups-by-path`, `/input-sessions/{id}/check-hothashes` — these were backend filesystem operations or session-coupled checks now superseded by the client-side flow.

## Lock API (multi-machine)

- `GET /system/lock` — check current lock status
- `POST /system/lock` — acquire lock (returns 409 if already held)
- `DELETE /system/lock` — release lock

Locks have a 30-minute TTL. See `docs/decisions/010-multi-machine-locking.md`.

## Data Flow

**Analyse (ingen sesjon opprettes ennå):**
1. User opens the app in browser at `http://localhost:8000` (or `http://localhost:5173` during Vite dev).
2. User selects a directory — the local Python client scans it directly.
3. Client hashes each image (hotpreview → hothash).
4. Client calls `POST /photos/check-hothashes` (session-independent) to find which are new.
5. If no new images: user is informed, no session is created.
6. Frontend shows StepFolderMap: one row per subdirectory, editable event names, automatic lookup of existing events via `POST /system/folder-event-lookup`.

**Registrering (etter brukerbekreftelse):**
7. Client creates a session via `POST /input-sessions`.
8. Client processes each new image: generates coldpreview, reads full EXIF.
9. Client sends each processed group to backend via `POST /input-sessions/{id}/groups`, including `event_id` per group based on the catalog map.
10. Backend stores metadata in PostgreSQL and writes coldpreview to disk.
11. Frontend fetches and displays images via backend API (coldpreviews served as HTTP files).

**Installation modes** (chosen in setup wizard, see ADR-009):
- Local: client + backend + pgserver on same machine
- Server: backend on server, one or more clients point to backend URL
- Client-only: install only the client, point to existing backend URL
