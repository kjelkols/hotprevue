# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hotprevue** is a photo management system for organizing, viewing, and accessing large image collections. It indexes images without moving or altering original files — only metadata is stored. The system is single-user with no authentication.

## Architecture

**Monorepo** with three main layers:

- **`/backend`** — FastAPI (Python), SQLAlchemy (sync, psycopg2), Alembic for migrations. Structure: `api/`, `core/`, `database/`, `models/`, `schemas/`, `services/`, `utils/`.
- **`/frontend`** — React 18 + TypeScript + Tailwind CSS + Vite. State: React Query (server), Zustand (client). UI primitives: Radix UI. **Browser-based** — the backend serves the built frontend as static files. Structure: `src/api/`, `src/types/`, `src/components/ui/`, `src/features/`, `src/pages/`, `src/stores/`, `src/hooks/`, `src/lib/`.
- **`/tests`** — pytest-based tests.

**Database:** pgserver (embedded PostgreSQL). No Docker needed. `HOTPREVUE_LOCAL=true` activates local mode.

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

## Local Backend as System Proxy

The backend is not a remote server — it is a **local process** running on the same machine as the user's files. This means it has full OS access: filesystem, native dialogs, subprocesses.

The browser UI has no filesystem access. All file operations go through the backend:

```
Browser (React)                  Python backend (local process)
      │  GET /system/browse            │
      │ ──────────────────────────→   │  os.scandir("/path/to/photos")
      │  { dirs, files }               │  ← reads directly from disk
      │ ←──────────────────────────   │
```

**Rule:** All filesystem operations in the frontend **must** go through `/system` endpoints — never attempt direct file access in the browser. New OS-level operations belong in `api/system.py`.

See `docs/decisions/003-local-backend-as-system-proxy.md` for full rationale.

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

Run these in WSL:

```sh
# Start backend (pgserver starter PostgreSQL automatisk)
make dev-backend
# eller direkte:
cd backend && HOTPREVUE_LOCAL=true uv run uvicorn main:app --host 0.0.0.0 --port 8000

# Åpne frontend i nettleseren (krever at backend kjører)
# → http://localhost:8000

# Start Vite dev-server med hot-reload (kjør i nytt skall):
make dev-frontend   # cd frontend && npm run dev:web  → http://localhost:5173

# Kjør tester
make test
# eller:
cd backend && uv run pytest tests/ -v

# Kjør én test
cd backend && uv run pytest tests/path/to/test_file.py::test_function_name

# Bygg frontend til statiske filer (må gjøres fra WSL, ikke Windows)
make build-web
# eller: cd frontend && npm run build:web  → frontend/dist/
```

**Merk:** `--reload` virker ikke med pgserver (socket-problem med subprocess).

**WSL-utvikling:** Bruk native WSL-stier (f.eks. `/mnt/c/Bilder`). Tkinter-dialogen («Velg…»-knappen) fungerer bare skikkelig i zip-distribusjonen på Windows.

## Bygge Windows zip-distribusjon (primær)

**Steg 1 — bygg frontend (WSL):**
```sh
make build-web
```

**Steg 2 — pakk zip (Windows PowerShell):**
```powershell
powershell -ExecutionPolicy Bypass -File "\\wsl$\Ubuntu-22.04\home\kjell\hotprevue\build-zip.ps1"
# Resultat: hotprevue/Hotprevue-0.1.0.zip  (~16 MB)
```

Zip-en inneholder: `backend/` (kildekode), `frontend/` (bygd), `uv.exe`, `Hotprevue.bat`.
Brukeren dobbeltklikker på `Hotprevue.bat` — backend starter og nettleseren åpnes automatisk.


## System API Endpoints

The backend exposes these endpoints for filesystem operations:

- `POST /system/pick-directory` — opens a native OS directory picker (tkinter), returns `{ path: string | null }`
- `POST /system/scan-directory` — scans a path for images, returns `{ groups: FileGroup[], total_files: number }`
- `POST /input-sessions/{id}/groups-by-path` — registers an image group by file path (backend reads file directly, no bytes transfer)

## Data Flow

1. User opens the app in browser at `http://localhost:8000` (or `http://localhost:5173` during Vite dev).
2. User selects a directory via the backend's directory picker (`/system/pick-directory`).
3. Backend scans the directory for images (`/system/scan-directory`).
4. Backend registers each image by path: extracts EXIF, generates hotpreview (base64, stored in DB) and coldpreview (file on disk), stores metadata and original file path.
5. Frontend uses database + coldpreview files for display. Original files are only accessed when explicitly needed.
6. To sync between machines: copy both the database and the coldpreview directory (they must stay in sync).
