# Changelog

Kronologisk logg over betydelige endringer i Hotprevue.

Format: `## YYYY-MM-DD — Kort beskrivelse`

---

## 2026-02-25 — Dokumentasjonsstruktur opprettet

- Opprettet `docs/`-struktur med `spec/`, `decisions/`, `vision/`
- Kravspesifikasjon skrevet: overview, domain, data-model, api, previews, file-handling, frontend
- Første ADR: 001 — hothash som unik bilde-ID
- Visjonsdokumenter: philosophy, future
- TODO og CHANGELOG opprettet

---

## 2025 (tidlig) — Initiell implementasjon

- FastAPI backend med SQLAlchemy async og Alembic
- Image-modell med hothash som PK
- Event-modell med self-referential hierarki
- Hotpreview og coldpreview-generering (Pillow)
- EXIF-ekstraksjon
- Tags (PostgreSQL ARRAY) og rating
- Testinfrastruktur: testcontainers + Alembic
- Docker Compose og Dockerfile for backend
- Infrastruktur for testbilder fra GitHub Releases
