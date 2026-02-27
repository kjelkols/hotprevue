# TODO

Prioritert liste over neste steg. Oppdateres ved hver arbeidsøkt.

Sist oppdatert: 2026-02-27 (sesjon 6)

---

## Pågående

*(ingenting pågår)*

---

## Neste — backend

- [ ] `POST /collections/{id}/clone` — klon collection (foto deles, text_items kopieres dypt)
- [ ] `GET/PATCH /settings` — SystemSettings
- [ ] `GET /tags` — distinkte tags med prefiks-filtrering og valgfri count
- [ ] Category — CRUD
- [ ] `GET /duplicates`, `DELETE /duplicates/{id}` — liste og fjern duplikater
- [ ] PhotoCorrection — GET/PUT/DELETE
- [ ] Stack — CRUD, coverbilde

---

## Neste — frontend

### Kjernekomponenter

- [ ] Forrige/neste i `PhotoDetailPage` — `useDetailNavStore` + `PhotoDetailHeader` (se `spec/photo-detail-view.md`)
- [ ] Tastaturnavigasjon (← →) i `PhotoDetailPage`
- [x] `SelectionTray` — bunnlinje + `SelectionModal` (intern gridvisning, fjern enkeltbilder) — se `spec/selection-tray.md`
- [x] InsertionPoint — kursormodell, innsettingshandling — se `spec/insertion-point.md`
- [ ] `Taskbar` med selection-teller

### Visningsmodus

- [ ] `CollectionPresentPage` (`/collections/:id/present`) — `SlidePresenter`, foto-slides + tekstkort-slides, notes-toggle (`N`), fullskjerm (`F`) (se `spec/collection-presentation.md`)
- [ ] `EventPresentPage` (`/events/:id/present`) — deler `SlidePresenter`, sortert etter `taken_at`

### Sider

- [ ] Events — liste, detalj (BrowseView for event)
- [ ] Photographers — liste, detalj
- [ ] Settings
- [ ] Registreringsassistent — knappen finnes, flyten delvis implementert

---

## Backlog

- [ ] Story/PhotoText — spec og implementasjon
- [ ] Perceptual hashing for duplikatdeteksjon
- [ ] Batch-oppdatering av filstiprefiks (Admin)
- [ ] Eksport av collection (HTML-pakke, se `spec/collection-presentation.md`)
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
- [x] Alembic-migrering: alle tabeller fra spec/data-model.md
- [x] ORM-modeller: Photographer, InputSession, Photo, ImageFile, DuplicateFile, SessionError, Event, Collection, CollectionItem, PhotoCorrection, Category, SystemSettings
- [x] FastAPI-app med lifespan og settings-bootstrap
- [x] Photographer — CRUD med API-endepunkter
- [x] Event — CRUD, trestruktur, hierarki med API-endepunkter
- [x] InputSession — opprett, check, groups (multipart), complete, statistikk
- [x] EXIF-ekstrahering: kuratert struktur lagret som JSONB
- [x] Duplikat- og feilhåndtering under registrering (DuplicateFile, SessionError)
- [x] GET /photos, GET /photos/{hothash} — liste vs. detalj-respons
- [x] GET /photos/{hothash}/files — ImageFiles
- [x] POST /photos/{hothash}/companions — legg til companion-fil
- [x] POST /photos/{hothash}/reprocess — last opp ny masterfil, regenerer coldpreview
- [x] Hotpreview (150×150 JPEG, base64, SHA256 = hothash) og coldpreview-generering
- [x] Test-infrastruktur: conftest.py med testcontainers PostgreSQL + Alembic-migrasjon
- [x] Integrasjonstester med reelle kamerabilder (Nikon D800 JPEG+NEF)
- [x] Test-bilder lastet opp til GitHub Releases (test-assets-v1)
- [x] PATCH /photos/{hothash} — oppdater metadata på enkeltbilde
- [x] Soft delete, restore, empty-trash på photos
- [x] Batch-endepunkter: tags/add, tags/remove, tags/set, rating, event, category, photographer, taken-at, taken-at-offset, location, delete, restore
- [x] Collection — CRUD + items (legg til, batch, rekkefølge, oppdater innhold, fjern)
- [x] CollectionItem: migrering 0003 (notes, card_data — erstattet av text_items i 0004)
- [x] spec/collection-presentation.md — Collection som presentasjonsmedium, visningsmodus, eksportarkitektur (oppdatert 2026-02-27)
- [x] Prosjektoppsett frontend: Vite + React 18 + TypeScript + Tailwind CSS + React Router + React Query + Zustand + Radix UI + dnd-kit
- [x] BrowseView — grid, progressiv lasting, dato-overlay
- [x] Avkryssingstilstand (click/ctrl+click/shift+click, visuell feedback)
- [x] Kontekstmeny — useContextMenuStore + ContextMenuOverlay
- [x] PhotoDetailPage — /photos/:hothash, coldpreview + PhotoMetaPanel
- [x] Grid-arkitektur: ThumbnailShell, selectionSlice, useCollectionViewStore, CollectionGrid med dnd-kit
- [x] Collections frontend — CollectionsListPage, CollectionPage, navigasjon fra HomePage
- [x] SelectionTray — bunnlinje + SelectionModal (Radix Dialog, intern grid, fjern enkeltbilder)
- [x] SessionsListPage, EventsListPage — inngangsporter fra HomePage til bilder
- [x] InsertionPoint — kursormodell (vertikal strek), kursorsone, tastaturnavigasjon, innsettingssekvens
- [x] TextItem-arkitektur — migrering 0004, `text_items`-tabell, CRUD-endepunkter, orphan-opprydding
- [x] `DELETE /collections/{id}/items/batch` — batch-slett på backend (frontend-UI utsatt, se `docs/drafts/collection-multi-select.md`)
- [x] TextCard-oppretting — modal dialog, tittel + brødtekst, settes inn ved InsertionPoint
