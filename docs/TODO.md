# TODO

Prioritert liste over neste steg. Oppdateres ved hver arbeidsøkt.

Sist oppdatert: 2026-02-25

---

## Pågående

*(ingenting pågår)*

## Neste

### Spec — gjenstående

- [ ] Story/PhotoText — domene-begrep er nevnt i `domain.md` men tabell og API-endepunkter mangler
- [ ] Korreksjon — domene-begrep er nevnt i `domain.md` men tabell og API-endepunkter mangler
- [ ] Bestem frontend-teknologi og oppdater `spec/frontend.md`

### Implementasjon — oppstart

- [ ] Slett gammel backend-kode: `backend/models/image.py` og `backend/alembic/versions/0001_initial.py`
- [ ] Ny Alembic-migrering: alle tabeller fra `spec/data-model.md`
- [ ] ORM-modeller: Photographer, InputSession, Photo, ImageFile, DuplicateFile, SessionError, Event, Collection, CollectionItem
- [ ] Tester: oppdater `tests/conftest.py` til ny datamodell

### Implementasjon — backend

- [ ] Photographer-endepunkter (CRUD)
- [ ] Event-endepunkter (CRUD, hierarki)
- [ ] InputSession-endepunkter (opprett, skann, prosesser, feil)
- [ ] Photo-endepunkter (list, hent, oppdater, slett)
- [ ] Duplicate-endepunkter (list, slett, valider)
- [ ] Collection-endepunkter (CRUD, items)
- [ ] Filstivalidering — endepunkt for å sjekke status på ImageFile-stier

### Infrastruktur

- [ ] Verifiser at `docker compose up` starter alt korrekt

## Backlog

- [ ] Frontend — oppstart og teknologivalg
- [ ] Story/PhotoText — implementasjon
- [ ] Korreksjon — implementasjon
- [ ] Perceptual hashing for duplikatdeteksjon
- [ ] Batch-oppdatering av filstiprefiks
- [ ] Eksport av collection

---

## Fullført

- [x] Dokumentasjonsstruktur under `docs/` (spec/, decisions/, vision/, drafts/)
- [x] `spec/overview.md` — formål, arkitektur, dataflyt
- [x] `spec/domain.md` — alle domene-begreper inkl. Photo, ImageFile, InputSession, DuplicateFile, SessionError
- [x] `spec/data-model.md` — alle tabeller med korrekte felt og relasjoner
- [x] `spec/api.md` — alle endepunkter inkl. duplikater, sesjonsfeil og scan/process-flyt
- [x] `spec/previews.md` — hotpreview og coldpreview
- [x] `spec/file-handling.md` — originalfiler, filtyper, validering, synk
- [x] `spec/frontend.md` — ruter, visninger, UX-prinsipper
- [x] `decisions/001-hothash-as-id.md`
- [x] `decisions/002-backend-collocated-with-files.md`
- [x] `vision/philosophy.md`
- [x] `vision/future.md` — inkl. Hotprevue Global
- [x] `scripts/export-api-docs.sh`
- [x] `git tag pre-spec-cleanup` — eksisterende kodebase bevart som referanse
