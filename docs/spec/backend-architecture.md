# Backend-arkitektur

## Lagdeling

```
HTTP-forespørsel
      ↓
┌─────────────────────────────────┐
│  api/          FastAPI-router   │  HTTP inn/ut, Pydantic validering
│  schemas/      Pydantic-modeller│  Request- og responstyper
└────────────┬────────────────────┘
             ↓ AsyncSession (via Depends)
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

**Ingen repository-lag.** SQLAlchemy ORM er allerede et abstraksjonslag mot databasen. Et ekstra repository-lag dupliserer dette uten gevinst og gjør testing mer komplisert. Service-laget kaller ORM direkte — standard praksis i moderne FastAPI-prosjekter.

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
- Mottar `db: AsyncSession` som parameter — eier ingenting selv
- Validerer forretningsregler og kaster `HTTPException` ved brudd
- Utfører SQL via SQLAlchemy ORM
- Committer etter vellykkede skriveoperasjoner
- Returnerer ORM-objekt eller liste av ORM-objekter
- Én fil per ressurs: `services/photo_service.py` osv.

### `models/`
- SQLAlchemy ORM-modeller med `Mapped[]`-typer
- Tabelldefinisjoner, FK-constraints og relasjoner
- Ingen forretningslogikk
- Én fil per tabell eller tett beslektet gruppe: `models/photo.py`, `models/event.py` osv.

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
  → await db.commit()
  → await db.refresh(photo)
  → returnerer Photo ORM-objekt

api/photos.py
  → konverterer til PhotoDetail via PhotoDetail.model_validate(photo)
  → returnerer 200 med PhotoDetail
```

---

## Session og transaksjoner

`get_db()` i `database/session.py` leverer én session per request via `Depends`:

```python
async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
```

**Commit-ansvar ligger i service-laget:**
- Leseoperasjoner: ingen commit
- Skriveoperasjoner: `await db.commit()` i service etter vellykkede endringer
- Ved feil: session-konteksten ruller tilbake automatisk

Sessionet overføres alltid som parameter til service-funksjoner — aldri opprettet inne i en service. Dette sikrer at én HTTP-request bruker én session gjennom hele kjeden.

---

## Relasjoner og lazy loading

SQLAlchemy async støtter ikke lazy loading av relasjoner. Alt som trengs i responsen må lastes eksplisitt i queryen.

```python
# Feil — kaster MissingGreenlet-feil i async-kontekst
photo.image_files  # forsøk på lazy load

# Riktig — last eksplisitt med selectinload
stmt = (
    select(Photo)
    .where(Photo.hothash == hothash)
    .options(selectinload(Photo.image_files))
    .options(selectinload(Photo.correction))
)
result = await db.execute(stmt)
photo = result.scalar_one_or_none()
```

**Regel:** Service-funksjoner som returnerer data med relasjoner bruker eksplisitt `selectinload()`. Listefunksjoner som ikke trenger relasjoner laster ingen.

---

## Feilhåndtering

| Situasjon | HTTP-statuskode | Håndteres i |
|---|---|---|
| Ressurs ikke funnet | `404` | Service |
| Forretningsregel brutt (hierarki, eksklusivt medlemskap) | `409 Conflict` | Service |
| Ugyldig request-body | `422 Unprocessable Entity` | Automatisk av Pydantic |
| DB-constraint-brudd (uventet) | `409 Conflict` | Service (fanger IntegrityError) |

Alle feil kastes som `HTTPException` fra service-laget. API-laget fanger ingenting — unntatt der HTTP-statuskode må overstyres av spesielle grunner.

Feilrespons følger konvensjonen fra `api.md`:
```json
{ "detail": "Photo not found" }
```

---

## Batch best-effort

Batch-endepunkter kjøres best-effort: gyldige Photos oppdateres, ugyldige rapporteres i responsen. Mønsteret er konsistent på tvers av alle batch-operasjoner:

```python
async def batch_set_rating(
    db: AsyncSession, hothashes: list[str], rating: int
) -> dict:
    updated, failed = [], []
    for hothash in hothashes:
        photo = await get_by_hothash(db, hothash)
        if photo is None:
            failed.append(hothash)
            continue
        photo.rating = rating
        updated.append(hothash)
    await db.commit()
    return {"updated": updated, "failed": failed}
```

Én commit etter alle operasjoner — ikke per element. Hvis commit feiler er ingenting lagret, noe som er tryggere enn halvferdig tilstand.

---

## Skjemavarianter — liste vs. detalj

`GET /photos` og `GET /photos/{hothash}` returnerer ulike felt (se `api.md`). Implementert via arv:

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

`PhotoDetail` arver alle felt fra `PhotoListItem` — ingen duplisering. Samme mønster brukes der andre ressurser har liste- og detaljvarianter.

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
    stack.py             # stack_id og is_stack_cover er felt på Photo —
                         # ingen egen tabell, men logikken samles her
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
