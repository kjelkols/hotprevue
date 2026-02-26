.PHONY: up down test test-all download-test-images

# Start alle tjenester
up:
	docker compose up

# Stopp alle tjenester
down:
	docker compose down

# Syntetiske tester (ingen bildenedlasting nødvendig)
test:
	cd backend && TESTCONTAINERS_RYUK_DISABLED=true uv run pytest tests/ -v

# Alle tester inkludert reelle kamerabilder
test-all: download-test-images
	cd backend && TESTCONTAINERS_RYUK_DISABLED=true uv run pytest tests/ -v --real-images

# Last ned lite testsett fra GitHub Release (standard)
download-test-images:
	uv run python scripts/download-test-images.py

# Last ned fullt testsett (~350 MB)
download-test-images-full:
	uv run python scripts/download-test-images.py --full

# Last ned på nytt selv om cache finnes
download-test-images-force:
	uv run python scripts/download-test-images.py --force
