.PHONY: up down test test-all download-test-images

# Start alle tjenester
up:
	docker compose up

# Stopp alle tjenester
down:
	docker compose down

# Syntetiske tester (ingen bildenedlasting nødvendig)
test:
	cd backend && uv run pytest tests/ -v

# Alle tester inkludert reelle kamerabilder
test-all: download-test-images
	cd backend && uv run pytest tests/ -v --real-images

# Last ned testbilder fra GitHub Release
download-test-images:
	cd backend && uv run python ../scripts/download-test-images.py

# Last ned på nytt selv om cache finnes
download-test-images-force:
	cd backend && uv run python ../scripts/download-test-images.py --force
