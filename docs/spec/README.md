# Spesifikasjon

Denne katalogen beskriver hva systemet gjør og hvordan. Spec-en skal speile faktisk tilstand: **ved avvik mellom spec og kode er koden (sammen med ADR-ene i `decisions/`) fasit — da skal spec-filen oppdateres**, ikke koden «rettes» tilbake.

Kjernefilene (`overview`, `domain`, `api`, `frontend`, `backend-architecture`) ble gjennomgått og synkronisert med koden i juli 2026. Filer merket ⚠ under er ikke gjennomgått og kan avvike fra koden.

## Filer

| Fil | Innhold |
|---|---|
| `overview.md` | Systemets formål, komponenter, ikke-mål og dataflyt |
| `domain.md` | Domenebegreper og definisjoner — én kilde til sannhet for terminologi |
| `api.md` | API-konvensjoner og endepunktoversikt (menneskelig lesbar) |
| `backend-architecture.md` | Lagdeling, synkron-regelen, feilhåndtering, mappestruktur |
| `frontend.md` | Ruter, stores, navigasjonskonvensjoner og UX-krav |
| `previews.md` | Hotpreview og coldpreview — generering, lagring og synkronisering |
| `file-handling.md` | ⚠ Originalfiler, ImageFiles, filstivalidering og synkstrategi |
| `file-copy.md` | ⚠ Kopiering fra minnekort (Lokale verktøy) |
| `file-reconciliation.md` | ⚠ Avstemming av filplasseringer |
| `photo-assignment.md` | Tilordning til event/samling — picker-modaler og batch-kontekstmeny |
| `context-menu.md` | Kontekstmeny-arkitektur og batch-handlinger |
| `selection-tray.md` | SelectionTray og SelectionModal |
| `grid-architecture.md` | PhotoGrid og CollectionGrid |
| `photo-detail-view.md` | Detaljvisning for ett bilde |
| `collection-presentation.md` | Kolleksjonspresentasjon og lysbildefremvisning |
| `push.md` | ⚠ Push/synk-tanker |
| `testing.md` | Teststrategi (pytest, `scripts/run-tests.sh`) |
| `data-model.md` | ⚠ Datamodell — utdatert; mangler Kind, Tag, Stack, maskinidentitet m.m. Se `backend/models/` |
| `distribution.md` | ⚠ Erstattet av `docs/program-distribution.md` |

Utkast og ideer som ikke er implementert ligger i `docs/drafts/` (f.eks. `insertion-point.md`).

## Bruk

- Les `overview.md` og `domain.md` først — de legger grunnlaget for alt annet.
- Ved tvil om terminologi: `domain.md` har fasit.
- Teknisk API-dokumentasjon genereres automatisk fra kjørende backend (`scripts/export-api-docs.sh`). `api.md` beskriver designintensjon og konvensjoner, ikke detaljerte request/response-skjemaer.
