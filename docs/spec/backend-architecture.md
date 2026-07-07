# Backend-arkitektur

## Ren API-server

Backenden er en ren API-server (ADR-008): den lagrer metadata i PostgreSQL, lagrer
coldpreviews på disk og serverer dem via HTTP. Den **leser aldri originalfiler**
og har ingen filsystem-endepunkter mot brukerens bildekataloger — all
filprosessering (skanning, EXIF, previews, hashing) skjer klientsiden i agenten.

Backenden kan kjøre lokalt (embedded PostgreSQL via pgserver, `HOTPREVUE_SERVER=local`,
se ADR-009) eller på en server med ekstern PostgreSQL. Den serverer også den bygde
frontenden som statiske filer (`HOTPREVUE_FRONTEND_DIR`).

`api/system.py` inneholder kun flermaskinlåsen (ADR-010) og
`folder-event-lookup` (ADR-024) — ingen filsystemoperasjoner.

> Historikk: ADR-003 («lokal systemproxy» med OS-tilgang) er erstattet av ADR-008.

---

## Synkron — alltid

**Backend er synkron. Bruk aldri `async def`, `await`, `AsyncSession` eller `asyncpg`.**

Hotprevue er et system med svært få samtidige brukere. Async gir ingen concurrency-gevinst og øker kompleksiteten uten nytte. Pillow (preview-generering) er synkront uansett. Sync er det riktige valget.

| Synkron (brukes) | Asynkron (brukes ikke) |
|---|---|
| `def` | `async def` |
| `Session` | `AsyncSession` |
| `create_engine` | `create_async_engine` |
| `psycopg2-binary` | `asyncpg` |
| `TestClient` (tester) | `AsyncClient` |
| Lazy loading fungerer normalt | `selectinload()` påkrevd |

---

## Autentisering og tilgang

- Maskiner (agent/klient) autentiserer med Bearer-token utstedt via invitasjonskode (`/auth/enroll`, ADR-040). Token-hash lagres i `machine_tokens`.
- Fotografer har `access_level` (`owner`/`guest`, ADR-044). `services/access_filter.py` filtrerer hva en gjest ser.
- Forespørsler uten token behandles i dag som eier («legacy owner»-modus bak Tailscale). Obligatorisk håndheving er en forutsetning for ADR-032 (eksponering uten Tailscale).

---

## Lagdeling

```
HTTP-forespørsel
      ↓
┌─────────────────────────────────┐
│  api/          FastAPI-router   │  HTTP inn/ut, Pydantic validering
│  schemas/      Pydantic-modeller│  Request- og responstyper
└────────────┬────────────────────┘
             ↓ Session (via Depends)
┌────────────────────────────────┐
│  services/   Forretningslogikk │  Regler, validering, orkestrering
└────────────┬───────────────────┘
             ↓ SQLAlchemy ORM
┌────────────────────────────────┐
│  models/     ORM-modeller      │  Tabelldefinisjoner og relasjoner
└────────────────────────────────┘
             ↓
       PostgreSQL
```

**Ingen repository-lag.** SQLAlchemy ORM er allerede et abstraksjonslag mot databasen. Et ekstra repository-lag dupliserer dette uten gevinst. Service-laget kaller ORM direkte.

Merk: enkle ressurser (f.eks. kinds, tags, shortcuts) kan ha logikken rett i
route-handleren når det ikke finnes forretningsregler å isolere — service-fil
opprettes når logikken vokser.

---

## Hvert lags ansvar

### `api/`
- Route-handlere kun — ingen forretningslogikk, ingen SQL (unntak: trivielle CRUD-ressurser)
- Mottar request, validerer via Pydantic-schema
- Kaller én service-funksjon
- Konverterer returnert ORM-objekt til Pydantic-responsschema
- Én fil per ressurs: `api/photos.py`, `api/events.py` osv.

### `schemas/`
- Pydantic-modeller for request-bodies og responser
- Én fil per ressurs: `schemas/photo.py`, `schemas/event.py` osv.
- Alle ORM-baserte skjemaer har `model_config = ConfigDict(from_attributes=True)`
- Liste- og detaljvarianter arver fra felles base (se Skjemavarianter)

### `services/`
- Inneholder all forretningslogikk
- Mottar `db: Session` som parameter — eier ingenting selv
- Validerer forretningsregler og kaster `HTTPException` ved brudd
- Utfører SQL via SQLAlchemy ORM
- Committer etter vellykkede skriveoperasjoner
- Returnerer ORM-objekt eller liste av ORM-objekter
- Én fil per ressurs: `services/photo_service.py` osv.

### `models/`
- SQLAlchemy ORM-modeller med `Mapped[]`-typer
- Tabelldefinisjoner, FK-constraints og relasjoner
- Ingen forretningslogikk

---

## Dataflyt — eksempel

```
PATCH /photos/{hothash}

api/photos.py
  → validerer PhotoPatchRequest (Pydantic)
  → henter db-session via Depends(get_db)
  → kaller photo_service.patch_photo(db, hothash, data)

services/photo_service.py
  → henter Photo via hothash → 404 hvis ikke funnet
  → oppdaterer felt
  → db.commit()
  → db.refresh(photo)
  → returnerer Photo ORM-objekt

api/photos.py
  → konverterer til PhotoDetail via PhotoDetail.model_validate(photo)
  → returnerer 200 med PhotoDetail
```

---

## Session og transaksjoner

`get_db()` i `database/session.py` leverer én session per request via `Depends`:

```python
def get_db() -> Generator[Session, None, None]:
    with SessionLocal() as session:
        yield session
```

**Commit-ansvar ligger i service-laget:**
- Leseoperasjoner: ingen commit
- Skriveoperasjoner: `db.commit()` i service etter vellykkede endringer
- Ved feil: session-konteksten ruller tilbake automatisk

Sessionet overføres alltid som parameter til service-funksjoner — aldri opprettet inne i en service.

---

## Feilhåndtering

| Situasjon | HTTP-statuskode | Håndteres i |
|---|---|---|
| Ressurs ikke funnet | `404` | Service |
| Forretningsregel brutt (hierarki, eksklusivt medlemskap) | `409 Conflict` | Service |
| Ugyldig request-body | `422 Unprocessable Entity` | Automatisk av Pydantic |
| DB-constraint-brudd (uventet) | `409 Conflict` | Service (fanger IntegrityError) |

Alle feil kastes som `HTTPException` fra service-laget. Feilrespons:
```json
{ "detail": "Photo not found" }
```

---

## Batch best-effort

```python
def batch_set_rating(db: Session, hothashes: list[str], rating: int) -> dict:
    updated, failed = [], []
    for hothash in hothashes:
        photo = get_by_hothash(db, hothash)
        if photo is None:
            failed.append(hothash)
            continue
        photo.rating = rating
        updated.append(hothash)
    db.commit()
    return {"updated": updated, "failed": failed}
```

Én commit etter alle operasjoner — ikke per element.

---

## Skjemavarianter — liste vs. detalj

```python
class PhotoListItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    hothash: str
    hotpreview_b64: str
    taken_at: datetime | None
    taken_at_accuracy: str
    rating: int | None
    # ... øvrige liste-felt

class PhotoDetail(PhotoListItem):
    exif_data: dict | None
    taken_at_source: int
    location_source: int | None
    input_session_id: uuid.UUID | None
    registered_at: datetime
    image_files: list[ImageFileSchema]
    correction: PhotoCorrectionSchema | None
```

`PhotoDetail` arver alle felt fra `PhotoListItem` — ingen duplisering.

---

## Mappestruktur

Én fil per ressurs i hvert lag. Faktisk innhold per juli 2026:

```
backend/
  api/        auth, admin, ai, photos, input_sessions, events, collections,
              text_items, stacks, tags, kinds, photographers, machines,
              searches, settings, share, shortcuts, stats, system, file_copy
  models/     photo (Photo, ImageFile, DuplicateFile, PhotoCorrection),
              input_session (InputSession, SessionError), event, collection,
              text_item, stack, tag (Tag, PhotoTag), kind, category,
              photographer, machine (Machine, MachineToken, MachineInviteCode),
              machine_lock, saved_search, settings, shortcut, ai,
              photo_field_edit, file_copy
  schemas/    speiler api/-ressursene
  services/   photo, input_session, event, collection, text_item, stack, tag,
              kind, photographer, search, shortcut, file_copy,
              access_filter, public_share
  utils/      exif, previews m.m.
  core/       config
  database/   session
  tests/      pytest (kjøres via scripts/run-tests.sh)
  alembic/    migrasjoner (kjøres via scripts/alembic-upgrade.sh)
  main.py
```
