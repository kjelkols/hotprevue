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

**Tests:** `/tests` — pytest-based.

**Database:** pgserver (embedded PostgreSQL) for local installs. `HOTPREVUE_LOCAL=true` activates local mode. External PostgreSQL for server installs. See ADR-009.

## Backend is Synchronous

**Never use async in backend code.** Hotprevue is a single-user system — async adds complexity with zero benefit. Pillow (image processing) is synchronous anyway.

- Route handlers: `def`, never `async def`
- Database session: `Session`, never `AsyncSession`
- Engine: `create_engine`, never `create_async_engine`
- Driver: `psycopg2-binary`, never `asyncpg`
- No `await` anywhere in backend code
- Tests: `TestClient`, never `AsyncClient` or `pytest-asyncio`

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
  - `HOTPREVUE_LOCAL=true` — activates pgserver mode (embedded DB)
  - `DATA_DIR` — override data directory (default: `%APPDATA%\Hotprevue` / `~/.local/share/Hotprevue`)
  - `HOTPREVUE_FRONTEND_DIR` — directory to serve as static frontend
  - `HOTPREVUE_OPEN_BROWSER=true` — open browser automatically on startup

## Domain Concepts

- **Stack:** Multiple images of the same subject grouped together. One image is the `is_stack_cover`. Stack has no own metadata — it's purely a display aid. Implemented via `stack_id` on individual images.
- **Event:** Unordered group of images tied to a happening (one-to-many: each image belongs to at most one event). Supports parent-child hierarchy.
- **Collection:** Ordered group of images where order matters (many-to-many). Used for slideshows, portfolios, deliveries. Each image can have a caption; text cards can be interspersed.
- **Companion files:** Each image can have associated files (RAW, JPEG, XMP, sidecar), stored as a list with type and file path.
- **Register session:** Each registration run creates a session linked to the registered images.

## Development Commands

```sh
# Start backend (pgserver starter PostgreSQL automatisk)
make dev-backend
# eller direkte:
cd backend && HOTPREVUE_LOCAL=true uv run uvicorn main:app --host 0.0.0.0 --port 8000

# Start Vite dev-server med hot-reload (tilgjengelig på nettverket, åpne i nettleser):
make dev-frontend   # cd frontend && npm run dev:web  → http://<server-ip>:5173

# Kjør tester
make test
# eller:
cd backend && uv run pytest tests/ -v

# Kjør én test
cd backend && uv run pytest tests/path/to/test_file.py::test_function_name

# Bygg frontend til statiske filer
make build-web
# eller: cd frontend && npm run build:web  → frontend/dist/
```

**Merk:** `--reload` virker ikke med pgserver (socket-problem med subprocess).

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


## Registration API Endpoints

- `POST /input-sessions/{id}/groups` — registers one processed image group; client sends hothash, hotpreview (base64), coldpreview (base64), EXIF, and file metadata. Backend stores in DB and writes coldpreview to disk.
- `POST /input-sessions/{id}/check-hothashes` — client sends list of hothashes, backend returns which are already registered. Call this *after* generating hotpreviews but *before* generating coldpreviews to skip duplicates early.

**Removed:** `/system/pick-directory`, `/system/scan-directory`, `/system/browse`, `/input-sessions/{id}/groups-by-path` — these were backend filesystem operations that are now the client's responsibility.

## Lock API (multi-machine)

- `GET /system/lock` — check current lock status
- `POST /system/lock` — acquire lock (returns 409 if already held)
- `DELETE /system/lock` — release lock

Locks have a 30-minute TTL. See `docs/decisions/010-multi-machine-locking.md`.

## Data Flow

1. User opens the app in browser at `http://localhost:8000` (or `http://localhost:5173` during Vite dev).
2. User selects a directory — the local Python client scans it directly.
3. Client processes each image: extracts EXIF, generates hotpreview, computes hothash, generates coldpreview.
4. Client calls `check-hothashes` to skip already-registered images before generating coldpreviews.
5. Client sends each processed group to backend via `POST /input-sessions/{id}/groups`.
6. Backend stores metadata in PostgreSQL and writes coldpreview to disk.
7. Frontend fetches and displays images via backend API (coldpreviews served as HTTP files).

**Installation modes** (chosen in setup wizard, see ADR-009):
- Local: client + backend + pgserver on same machine
- Server: backend on server, one or more clients point to backend URL
- Client-only: install only the client, point to existing backend URL
