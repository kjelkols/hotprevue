# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Hotprevue** is a photo management system for organizing, viewing, and accessing large image collections. It indexes images without moving or altering original files — only metadata is stored. The system is single-user with no authentication.

## Architecture

**Monorepo** with three main layers:

- **`/backend`** — FastAPI (Python), SQLAlchemy (sync, psycopg2), Alembic for migrations. Structure: `api/`, `core/`, `database/`, `models/`, `schemas/`, `services/`, `utils/`.
- **`/frontend`** — React 18 + TypeScript + Tailwind CSS + Vite. State: React Query (server), Zustand (client). UI primitives: Radix UI. Optional Electron wrapper via electron-vite. Structure: `src/api/`, `src/types/`, `src/components/ui/`, `src/features/`, `src/pages/`, `src/stores/`, `src/hooks/`, `src/lib/`.
- **`/tests`** — pytest-based tests.

**Database:** PostgreSQL, run via Docker Compose.

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

## Key Technical Decisions

- **"Register" not "import":** Never use the word "import" when referring to adding images to the system. The system *registers* image metadata, it does not import or move files.
- **No original file storage:** Only metadata and file paths are stored. Original files remain wherever the user keeps them.
- **Hotpreview:** 150×150px thumbnail, base64-encoded, stored in the database. SHA256 of hotpreview = `hothash` (used as unique image ID).
- **Coldpreview:** 800–1200px preview, stored on disk in a hash-based directory structure (e.g., `/data/coldpreviews/ab/cd/abcd1234...jpg`). Can always be regenerated from the original.
- **Base64 for all image binary data** in API responses.
- **API must listen on `0.0.0.0`** to be reachable via Tailscale and Docker.
- **Environment variables** for database URL and all configuration.

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

# Start Electron-frontend (i nytt skall, krever at backend kjører)
make dev-frontend
# eller direkte:
cd frontend && npm run dev

# Kjør tester
make test
# eller:
cd backend && uv run pytest tests/ -v

# Kjør én test
cd backend && uv run pytest tests/path/to/test_file.py::test_function_name
```

## Bygge Windows-installer

Kjøres fra **Windows PowerShell** (ikke WSL):

```powershell
# Steg 1: bygg backend-binær (PyInstaller)
cd "\\wsl$\Ubuntu-22.04\home\kjell\hotprevue\backend"
$env:UV_PROJECT_ENVIRONMENT = ".venv-win"
uv run --python 3.12 --with pyinstaller pyinstaller hotprevue.spec

# Steg 2: kopier til byggkatalog og bygg installer
robocopy "\\wsl$\Ubuntu-22.04\home\kjell\hotprevue\frontend" "C:\hotprevue-build\frontend" /e /xd node_modules
robocopy "\\wsl$\Ubuntu-22.04\home\kjell\hotprevue\backend\dist" "C:\hotprevue-build\backend\dist" /e
cd C:\hotprevue-build\frontend
npm install
npm run dist
# Installer: C:\hotprevue-build\frontend\dist-installer\Hotprevue Setup x.x.x.exe
```

**Merk:** Bygg alltid backend-binæren på Windows (PyInstaller lager platform-spesifikke binærer).

## Data Flow

1. User selects a directory of original images on their local filesystem.
2. Backend registers each image: extracts EXIF, generates hotpreview (base64, stored in DB) and coldpreview (file on disk), stores metadata and original file path.
3. Frontend uses database + coldpreview files for display. Original files are only accessed when explicitly needed.
4. To sync between machines: copy both the database and the coldpreview directory (they must stay in sync).
