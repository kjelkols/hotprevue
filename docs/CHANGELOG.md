# Changelog

Kronologisk logg over betydelige endringer i Hotprevue.

Format: `## YYYY-MM-DD — Kort beskrivelse`

---

## 2026-03-01 — Filkopiering og katalogsnarveier

- Valgfritt kopieringssteg i registreringsprosessen: kopiér fra minnekort/ekstern kilde til destinasjon før skanning
- `file_copy_operations` og `file_copy_skips` tabeller (migrasjon 0010)
- `utils/file_copy.py`: kopieringsmotor med ThreadPoolExecutor, SHA256-verifisering, avbrytelse via `threading.Event`, EXIF-basert katalognavn-forslag (Tab-completion)
- `GlobalSettings`: `copy_verify_after_copy` og `copy_include_videos`
- FileBrowser: `imagesOnly`-prop — `false` viser alle kataloger uten bildefilter (brukes til destinasjonsvalg)
- Backend `GET /system/browse` fikk `images_only`-param (default `true`)
- Snarveier (migrasjon 0011): `shortcuts`-tabell med `machine_id`, `name`, `path`, `position`
- `GET/POST/PATCH/DELETE /shortcuts` + `move-up`/`move-down`
- Standardsnarvei «Hjemmeområde» seedes automatisk ved nyinstallasjon
- FileBrowser viser snarveier som chips under navigasjonsheaderen; brukes som startpunkt
- Ny innstillingsfane «Snarveier» med liste, inline navneredigering, rekkefølgestyring og legg-til-skjema

---

## 2026-02-28 — Perceptual hashes

- `photos.dct_perceptual_hash` og `photos.difference_hash` (BIGINT, migrasjon 0008) — 64-bit perceptual hashes beregnet fra hotpreview ved registrering
- `utils/previews.py`: `compute_perceptual_hashes(jpeg_bytes)` — returnerer `(dct_perceptual_hash, difference_hash)` via `imagehash`-biblioteket
- `POST /photos/compute-perceptual-hashes` — fyller ut hashene retroaktivt for eksisterende bilder fra `hotpreview_b64` i DB, uten tilgang til originalfiler
- Hashes eksponert i `PhotoListItem` og `PhotoDetail` (API + TypeScript-typer)
- 6 nye unit-tester i `TestPerceptualHashes` — inkl. test på at NEF og JPEG fra samme eksponering har lav Hamming-avstand
- Beslutningsdokument: `docs/decisions/004-perceptual-hash.md`

---

## 2026-02-28 — EXIF per ImageFile og RAW-støtte

- EXIF flyttet fra `Photo` til `ImageFile` — hvert bilde har sin egen `exif_data` (JSONB), migrasjon 0007
- `ImageFile` fikk `exif_data`, `width`, `height`, `file_size_bytes`, `last_verified_at`
- `utils/exif.py` skrevet om med to backends: Pillow (JPEG/TIFF/PNG/HEIC) og exifread (CR2, NEF, ARW, DNG, ORF, RW2, RAF, PEF, SRW)
- `utils/previews.py`: rawpy-støtte for RAW hotpreview (embedded JPEG thumbnail, rask) og coldpreview (full LibRaw decode)
- RAW-first master-valg: ved RAW+JPEG-par er RAW alltid master
- `api/system.py` refaktorert til å bruke `utils/registration.scan_directory()` — eliminerte duplisert skanne-logikk
- 28 unit- og integrasjonstester med virkelige kamerafiler (Nikon D800 NEF + JPEG)
- Bugfix: MPO-format (Nikon Multi-Picture Object) krevde `.copy()` etter `Image.open()` for å forhindre lazy-load-krasj

---

## 2026-02-27 — Toppnavigasjon

- `TopNav.tsx` — persistert navigasjonsbar: Hotprevue-logo + fire NavLink-tabs (Utvalg, Events, Kolleksjoner, Sesjoner) + selection-teller til høyre
- `AppLayout.tsx` — layout-wrapper (h-screen flex-col) med TopNav + scrollbar Outlet
- Nestede ruter i `App.tsx` — AppLayout wrapper rundt alle hovedruter; SetupPage og CollectionPresentPage forblir utenfor
- `HomePage` forenklet — navigasjonsknapper fjernet, kun registreringsknapp igjen
- "← Tilbake til /" fjernet fra liste-sider (CollectionsListPage, SessionsListPage, EventsListPage)

---

## 2026-02-27 — ZoomableImage — generell scroll+pan-modul

- `src/hooks/useImageZoom.ts` — scroll-til-zoom mot musepeker (1×–4×), dra-for-pan; `ctrlKey` ignoreres (overlates til nettleseren); `deltaMode`-normalisering for jevn trackpad-opplevelse
- `src/components/ZoomableImage.tsx` — generell komponent, fyller containeren, all tilstand intern; reset via `key`-prop
- Brukes i `PhotoDetailPage` (venstre panel) og `PhotoSlideView` (presentasjonsmodus)
- Ingen knapper, ingen prosentvisning — kun scroll og pan

---

## 2026-02-27 — HTML-eksport av collection

- `GET /collections/{id}/export` — returnerer ZIP-arkiv med `index.html` + `slides/*.jpg`
- `backend/utils/html_export.py` — selvinneholdt HTML-presentasjonsmal (~160 linjer) med inline CSS og vanilla JS; ingen nettverkskall, fungerer fra `file://`
- Funksjoner: piltastnavigering (← → Space), klikksoner venstre/høyre, 150 ms crossfade, fullskjerm (F), notatpanel (N), innebygd Markdown-renderer, HTML-escaping
- `collection_service.export_zip()` — bygger ZIP i minnet med `zipfile` + `io.BytesIO`; hopper over manglende coldpreview-filer
- «Eksporter ↓»-knapp i `CollectionPage`-header (direkte `<a download>`, ingen fetch)

---

## 2026-02-27 — CollectionPresentPage — visningsmodus

- Rute `/collections/:id/present` — dedikert fullskjerm visningsmodus
- `SlidePresenter` — navigation, crossfade (150 ms fade-ut/inn), fullskjerm (F), notater (N), URL-sync `?slide=N`
- `PhotoSlideView` — coldpreview sentrert med `object-contain` på svart bakgrunn, caption under
- `TextSlideView` — innebygget Markdown-renderer (# h1, ## h2, avsnitt) sentrert i slideflate
- `SlideNotesPanel` — vises under bildet ved N-toggle
- `useSlideKeyboard` — tastaturhook (← → Space Esc N F), stale-closure-sikker via ref
- «Vis ▶»-knapp i CollectionPage-header lenker til presentasjonsruten
- Bugfix: `useCollectionViewStore` hadde ikke `clear` — fjernet stale referanse fra `App.tsx`
- Nye filer: `types/presentation.ts`, `features/present/` (5 filer), `pages/CollectionPresentPage.tsx`

---

## 2026-02-27 — Rubber-band-seleksjon deaktivert i CollectionGrid

- `select-none` lagt til på grid-containeren — forhindrer nettleserens innebygde element-seleksjon ved klikk-og-dra
- Ekte rubber-band multi-select er utsatt — ordnet sekvens gjør det tvetydig (visuell posisjon ≠ sekvensposisjon)
- Funksjonaliteten er utredet og dokumentert for fremtidig implementasjon i `docs/drafts/rubber-band-selection.md`

---

## 2026-02-27 — InsertionPoint kursormodell fjernet

- Kursoren (blå vertikal strek) var ikke intuitiv: sto fast på slutten ved klikk og utløste browser-nativ rubber-band-selection ved dra
- Fjernet: `InsertionPoint.tsx`, `CursorEndIndicator.tsx`, `insertionIndex`/`setInsertionPoint` fra `useCollectionViewStore`
- Fotos og tekstkort settes nå alltid inn på slutten av kolleksjonen
- Spec arkivert til `docs/drafts/insertion-point.md`

---

## 2026-02-27 — Drag-and-drop visuell forbedring

- Drop-destinasjonen i CollectionGrid viser nå stiplet blå kant med blek forhåndsvisning av bildet som flyttes, i stedet for sort hull

---

## 2026-02-27 — TextCard-oppretting

- Modal dialog («+ Tekstkort» i collection-header) med tittel- og brødtekstfelt
- Markup-format: `# Tittel\n\nBrødtekst` — lagres i eksisterende `TextItem.markup`-felt, ingen schemaendringer
- `TextCard` rendrer nå tittel (semibold) og brødtekst (grå) sentrert i cellen
- Nytt tekstkort settes inn ved aktiv InsertionPoint-posisjon; cursoren flyttes ett steg fremover
- Nye filer: `TextCardCreateDialog.tsx`, `src/api/text-items.ts`

---

## 2026-02-27 — Opprydding: collection-seleksjon fjernet fra frontend

- Collection-intern seleksjon (SelectionSlice i useCollectionViewStore), CollectionActionBar og CollectionDragOverlay fjernet etter at multi-drag ikke lot seg få til å fungere pålitelig med dnd-kit
- Backend `DELETE /collections/{id}/items/batch` beholdes
- Problemstilling og fremtidige alternativer dokumentert i `docs/drafts/collection-multi-select.md`
- `activationConstraint: { distance: 8 }` på PointerSensor beholdes (fikset click-registrering)

---

## 2026-02-27 — TextItem-arkitektur og CollectionActionBar

- Migrering 0004: `text_items`-tabell; fjernet `card_type`/`title`/`text_content`/`card_data` fra `collection_items`; lagt til `text_item_id UUID FK`; CHECK constraint sikrer nøyaktig ett av `hothash`/`text_item_id`
- TextItem CRUD: `POST /text-items`, `GET /text-items/{id}`, `PATCH /text-items/{id}`, `DELETE /text-items/{id}` (med orphan-sjekk)
- `DELETE /collections/{id}/items/batch` — fjern flere collection-items på én gang; orphan text_items ryddes automatisk
- `CollectionActionBar` — handlingsbar i CollectionView når ett eller flere items er valgt: "Flytt hit" og "Fjern fra kolleksjon"
- Collection-intern selection (`useCollectionViewStore`) er isolert fra global `useSelectionStore`

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
- Rating
- Testinfrastruktur: testcontainers + Alembic
- Docker Compose og Dockerfile for backend
- Infrastruktur for testbilder fra GitHub Releases
