# Changelog

Kronologisk logg over betydelige endringer i Hotprevue.

Format: `## YYYY-MM-DD — Kort beskrivelse`

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
