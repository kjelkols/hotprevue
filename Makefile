.PHONY: dev-backend dev-frontend build-web test download-test-images download-test-images-full download-test-images-force

# ─── Utvikling (WSL) ──────────────────────────────────────────────────────────

# Start backend med pgserver (lokal PostgreSQL, ingen Docker)
dev-backend:
	cd backend && HOTPREVUE_LOCAL=true uv run uvicorn main:app --host 0.0.0.0 --port 8000

# Start Vite dev-server i nettleseren (krever at backend kjører)
dev-frontend:
	cd frontend && npm run dev:web

# Bygg frontend som statiske filer (for zip-distribusjon)
build-web:
	cd frontend && npm run build:web

# ─── Testing (WSL) ────────────────────────────────────────────────────────────

test:
	cd backend && uv run pytest tests/ -v

download-test-images:
	uv run python scripts/download-test-images.py

download-test-images-full:
	uv run python scripts/download-test-images.py --full

download-test-images-force:
	uv run python scripts/download-test-images.py --force
