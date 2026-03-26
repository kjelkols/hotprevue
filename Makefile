.PHONY: dev-backend dev-frontend build-web test \
        download-test-images download-test-images-full download-test-images-force \
        build-zip-windows build-zip-linux build-zip-all

VERSION := $(shell git describe --tags --abbrev=0 2>/dev/null | sed 's/^v//' || echo "dev")

DIST_EXCLUDES := \
	--exclude='.venv' --exclude='.venv-win' --exclude='dist' --exclude='build' \
	--exclude='__pycache__' --exclude='.pytest_cache' --exclude='tests' \
	--exclude='.env' --exclude='Dockerfile' --exclude='.dockerignore' \
	--exclude='hotprevue.spec'

# ─── Utvikling ────────────────────────────────────────────────────────────────

# Start backend med pgserver (lokal PostgreSQL, ingen Docker)
dev-backend:
	cd backend && HOTPREVUE_SERVER=local uv run uvicorn main:app --host 0.0.0.0 --port 8000

# Start Vite dev-server med hot-reload (tilgjengelig på nettverket via 0.0.0.0)
dev-frontend:
	cd frontend && npm run dev:web

# Bygg frontend til statiske filer
build-web:
	cd frontend && npm run build:web

# ─── Testing ──────────────────────────────────────────────────────────────────

test:
	cd backend && uv run pytest tests/ -v

download-test-images:
	uv run python scripts/download-test-images.py

download-test-images-full:
	uv run python scripts/download-test-images.py --full

download-test-images-force:
	uv run python scripts/download-test-images.py --force

# ─── Distribusjon ─────────────────────────────────────────────────────────────

build-zip-windows: build-web
	@echo "→ Bygger Windows zip (v$(VERSION))..."
	rm -rf hotprevue-dist-windows && mkdir -p hotprevue-dist-windows
	rsync -a $(DIST_EXCLUDES) backend/ hotprevue-dist-windows/backend/
	mkdir -p hotprevue-dist-windows/frontend && cp -r frontend/dist/. hotprevue-dist-windows/frontend/
	cp -r admin/ hotprevue-dist-windows/admin/
	curl -fsSL "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-pc-windows-msvc.zip" -o _uv-win.zip
	unzip _uv-win.zip uv.exe -d hotprevue-dist-windows/ && rm _uv-win.zip
	cp Hotprevue.bat hotprevue-admin.bat install.bat hotprevue-dist-windows/
	cd hotprevue-dist-windows && zip -r "../Hotprevue-$(VERSION)-windows.zip" .
	rm -rf hotprevue-dist-windows
	@echo "✓ Hotprevue-$(VERSION)-windows.zip"

build-zip-linux: build-web
	@echo "→ Bygger Linux zip (v$(VERSION))..."
	rm -rf hotprevue-dist-linux && mkdir -p hotprevue-dist-linux
	rsync -a $(DIST_EXCLUDES) backend/ hotprevue-dist-linux/backend/
	mkdir -p hotprevue-dist-linux/frontend && cp -r frontend/dist/. hotprevue-dist-linux/frontend/
	cp -r admin/ hotprevue-dist-linux/admin/
	curl -fsSL "https://github.com/astral-sh/uv/releases/latest/download/uv-x86_64-unknown-linux-gnu.tar.gz" -o _uv-linux.tar.gz
	tar -xzf _uv-linux.tar.gz --strip-components=1 -C hotprevue-dist-linux/ uv-x86_64-unknown-linux-gnu/uv && rm _uv-linux.tar.gz
	cp hotprevue.sh hotprevue-admin.sh install.sh hotprevue-dist-linux/
	chmod +x hotprevue-dist-linux/uv hotprevue-dist-linux/hotprevue.sh hotprevue-dist-linux/hotprevue-admin.sh hotprevue-dist-linux/install.sh
	cd hotprevue-dist-linux && zip -r "../Hotprevue-$(VERSION)-linux.zip" .
	rm -rf hotprevue-dist-linux
	@echo "✓ Hotprevue-$(VERSION)-linux.zip"

build-zip-all: build-web
	$(MAKE) build-zip-windows
	$(MAKE) build-zip-linux
