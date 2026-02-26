# TODO

Prioritert liste over neste steg. Oppdateres ved hver arbeidsøkt.

Sist oppdatert: 2026-02-26

---

## Pågående

*(ingenting pågår)*

---

## Neste — backend

### 1. Fundament
- [ ] Ny Alembic-migrering: alle tabeller fra `spec/data-model.md`
- [ ] ORM-modeller: Photographer, InputSession, Photo, ImageFile, DuplicateFile, SessionError, Event, Collection, CollectionItem, PhotoCorrection, Category, SystemSettings
- [ ] `backend/main.py` — ny FastAPI-app med lifespan og settings-bootstrap

### 2. Basisendepunkter
- [ ] `GET/PATCH /settings` — SystemSettings med bootstrap ved første oppstart
- [ ] Photographer — CRUD
- [ ] Category — CRUD
- [ ] Event — CRUD, trestruktur, hierarki
- [ ] Tags — `GET /tags`

### 3. Registrering
- [ ] InputSession — opprett, skann, prosesser, statistikk
- [ ] Filgruppering ved skanning (RAW+JPEG-par, XMP-sidecar)
- [ ] EXIF-feltmapping: `extract_exif()` → Photo-kolonner (camera_make, iso osv.)
- [ ] Duplikat- og feilhåndtering under prosessering

### 4. Photo
- [ ] `GET /photos`, `GET /photos/{hothash}` — liste vs. detalj-respons
- [ ] `PATCH /photos/{hothash}` — metadata
- [ ] Soft delete, restore, empty-trash
- [ ] Reset-time, reset-location
- [ ] Batch-endepunkter (tags, rating, event, category, photographer, taken-at, location, delete, restore)
- [ ] PhotoCorrection — GET/PUT/DELETE, generer korrigert coldpreview fra original coldpreview

### 5. Øvrige ressurser
- [ ] Collection — CRUD, items (batch, rekkefølge, innhold)
- [ ] Stack — CRUD, coverbilde
- [ ] Duplicate — list, slett, valider
- [ ] `GET /photos/{hothash}/files` — ImageFiles

---

## Neste — frontend

### 1. Prosjektoppsett
- [ ] Vite + React 18 + TypeScript + Tailwind CSS
- [ ] React Router, React Query, Zustand, Radix UI
- [ ] `src/api/`, `src/types/`, `src/components/ui/`, `src/features/`, `src/pages/`-struktur

### 2. Kjernekomponenter
- [ ] `BrowseView` — grid, progressiv lasting, tooltip
- [ ] Avkryssingstilstand (click/ctrl/shift, visuell feedback)
- [ ] `SelectionTray` — frittstående vindu med handlinger
- [ ] `Taskbar` med selection-teller

### 3. Sider
- [ ] `HomePage`
- [ ] Events, Collections, Photographers
- [ ] Detaljvisning med korreksjonsverktøy
- [ ] Registreringsassistent (5-stegs flyt)
- [ ] Settings, Admin

---

## Backlog

- [ ] Story/PhotoText — spec og implementasjon
- [ ] Perceptual hashing for duplikatdeteksjon
- [ ] Batch-oppdatering av filstiprefiks (Admin)
- [ ] Eksport av collection
- [ ] Electron-wrapper via electron-vite
- [ ] TanStack Virtual for ytelsesoptimering av BrowseView

---

## Fullført

- [x] Dokumentasjonsstruktur under `docs/` (spec/, decisions/, vision/, drafts/)
- [x] Alle spec-filer: domain.md, data-model.md, api.md, frontend.md, previews.md, file-handling.md
- [x] Terminologi låst: BrowseView, CollectionView, SelectionTray, InsertionPoint, Lysbord, Avkryssingstilstand
- [x] SystemSettings spesifisert (installation_id, eierinfo, visnings- og coldpreview-innstillinger)
- [x] Liste vs. detalj-respons for GET /photos dokumentert
- [x] Sorteringsalternativer for GET /photos dokumentert
- [x] Frontend-teknologi valgt: React + TypeScript + Tailwind + Vite + React Query + Zustand + Radix UI
- [x] Arkitekturprinsipper dokumentert i frontend.md og CLAUDE.md
- [x] Scrolling/selection/tooltip/visuell feedback spesifisert
- [x] Gammel backend-kode slettet
- [x] tests/ flyttet til backend/tests/ (sys.path-hack fjernet)
- [x] decisions/001-hothash-as-id.md, decisions/002-backend-collocated-with-files.md
