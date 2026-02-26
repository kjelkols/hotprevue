# Backend-arkitektur

## Synkron — alltid

**Backend er synkron. Bruk aldri `async def`, `await`, `AsyncSession` eller `asyncpg`.**

Hotprevue er et én-bruker-system. Async gir ingen concurrency-gevinst og øker kompleksiteten uten nytte. Pillow (preview-generering) er synkront uansett. Sync er det riktige valget.

| Synkron (brukes) | Asynkron (brukes ikke) |
|---|---|
| `def` | `async def` |
| `Session` | `AsyncSession` |
| `create_engine` | `create_async_engine` |
| `psycopg2-binary` | `asyncpg` |
| `TestClient` (tester) | `AsyncClient` |
| Lazy loading fungerer normalt | `selectinload()` påkrevd |

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

---

## Hvert lags ansvar

### `api/`
- Route-handlere kun — ingen forretningslogikk, ingen SQL
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
    tags: list[str]
    # ... øvrige liste-felt

class PhotoDetail(PhotoListItem):
    coldpreview_path: str | None
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

```
backend/
  api/
    __init__.py
    photos.py
    events.py
    collections.py
    stacks.py
    input_sessions.py
    photographers.py
    categories.py
    tags.py
    duplicates.py
    settings.py
  models/
    __init__.py
    base.py
    photo.py
    event.py
    collection.py
    input_session.py
    photographer.py
    category.py
    settings.py
  schemas/
    __init__.py
    photo.py
    event.py
    collection.py
    input_session.py
    photographer.py
    category.py
    settings.py
    common.py            # delte typer, f.eks. BatchResult
  services/
    __init__.py
    photo_service.py
    event_service.py
    collection_service.py
    input_session_service.py
    photographer_service.py
    category_service.py
    settings_service.py
  utils/
    __init__.py
    exif.py
    previews.py
  core/
    __init__.py
    config.py
  database/
    __init__.py
    session.py
  tests/
    ...
  alembic/
    ...
  main.py
```
