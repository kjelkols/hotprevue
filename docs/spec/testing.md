# Teststrategi

## To nivåer

### Unit-tester
Rene funksjoner uten database. Lynraske, ingen eksterne avhengigheter.

Dekker:
- `utils/exif.py` — EXIF-uttrekk og felt-mapping
- `utils/previews.py` — preview-generering og hothash-beregning
- Isolerbar forretningslogikk

### Integrasjonstester
HTTP-klient mot ekte PostgreSQL-testdatabase. Tester hele stakken fra API til database.

Dekker:
- Alle API-endepunkter (happy path)
- Database-constraints og kaskaderegler
- Kritiske forretningsregler

**Hvorfor ikke mocke databasen?**
For et databasesentrisk system gir full mocking liten verdi. FK-constraints, GIN-indekser, kaskadesletting og Alembic-migreringslogikk testes kun mot ekte schema. Testcontainers spinner opp PostgreSQL automatisk — ingen grunn til å simulere det bort.

---

## Testinfrastruktur

`backend/tests/conftest.py` tilbyr:

| Fixture | Scope | Beskrivelse |
|---|---|---|
| `database_url` | session | Testcontainers PostgreSQL eller `TEST_DATABASE_URL` env-var |
| `run_migrations` | session, autouse | Kjører `alembic upgrade head` mot testdatabasen |
| `client` | function | `AsyncClient` koblet til test-DB via dependency override |
| `sample_image_path` | function | Liten unik JPEG i `tmp_path` — unik farge per test gir unik hothash |
| `real_image_dir` | session | Sti til nedlastede kamerabilder (krever `--real-images`) |

---

## Filstruktur

```
backend/tests/
  conftest.py
  utils/
    test_exif.py
    test_previews.py
  api/
    test_settings.py
    test_photographers.py
    test_categories.py
    test_events.py
    test_tags.py
    test_input_sessions.py
    test_photos.py
    test_photos_batch.py
    test_collections.py
    test_stacks.py
    test_duplicates.py
```

---

## Unit-tester — utils

### `test_previews.py`

| Test | Hva verifiseres |
|---|---|
| `test_hotpreview_is_150x150` | Output er eksakt 150×150 JPEG |
| `test_hothash_is_sha256_of_jpeg_bytes` | SHA256 av JPEG-bytene — ikke av originalfilen |
| `test_same_image_same_hothash` | Deterministisk — samme input gir samme hash |
| `test_different_images_different_hothash` | Ulike bilder gir ulike hashes |
| `test_coldpreview_path_structure` | `<dir>/ab/cd/abcd…jpg`-format |
| `test_coldpreview_max_long_side` | Lengste kant ≤ konfigurert maks |
| `test_coldpreview_preserves_aspect_ratio` | Proporsjonalt skalert |
| `test_rgba_image_converts_to_rgb` | Ingen kanal-feil ved JPEG-lagring |

### `test_exif.py`

| Test | Hva verifiseres |
|---|---|
| `test_extract_taken_at_from_datetime_original` | Parser `DateTimeOriginal` korrekt |
| `test_extract_taken_at_fallback_to_datetime` | Faller tilbake på `DateTime` |
| `test_extract_taken_at_missing_returns_none` | Ingen krasj ved manglende tag |
| `test_exif_output_is_json_serialisable` | Ingen bytes/IFDRational i output |
| `test_exif_handles_corrupt_file` | Logger advarsel, returnerer tomt dict |

---

## Integrasjonstester — API

Hvert endepunkt får minst én happy-path-test. I tillegg dekkes kritiske forretningsregler eksplisitt.

### `test_settings.py`
- Bootstrap: raden opprettes automatisk ved første kall
- `installation_id` er satt og er en gyldig UUID
- `PATCH /settings` oppdaterer mutablete felt
- `installation_id` ignoreres stille i PATCH

### `test_photographers.py`
- CRUD happy path
- Slett fotograf med tilknyttede Photos feiler

### `test_categories.py`
- CRUD happy path
- `excluded_from_stream` påvirker `GET /photos?in_stream=true`

### `test_events.py`
- CRUD happy path
- Trestruktur returneres fra `GET /events`
- Opprette child-event under rot-event
- Opprette child under child avvises (maks ett nivå)
- `DELETE` med children returnerer 409
- Flytte event via `PATCH` (`parent_id`)
- Rot-event med children kan ikke gjøres om til child
- Sletting setter `event_id = null` på Photos — Photos beholdes

### `test_input_sessions.py`
- Opprett sesjon
- Skann katalog → gruppesammendrag
- Duplikat hothash registreres i DuplicateFile, ikke som ny Photo
- Feilende filer logges i SessionError
- Rescan: allerede registrerte filer hoppes over stille

### `test_photos.py`
- `GET /photos` — filtrering på event, fotograf, tags, rating, kategori, in_stream
- `GET /photos` — sortering
- `GET /photos/{hothash}` — full detaljrespons inkl. exif_data og ImageFiles
- `PATCH /photos/{hothash}` — oppdater enkeltfelt
- Soft delete: `deleted_at` settes, Photo filtreres ut fra standard liste
- Restore: `deleted_at` nullstilles
- Re-registrering av slettet Photo: gjenopprettes stille
- `empty-trash`: hard-sletter, coldpreview-fil fjernes fra disk
- `reset-time`: tilbakestiller til original EXIF
- `reset-location`: tilbakestiller til original EXIF GPS
- PhotoCorrection PUT/GET/DELETE
- Korrigert coldpreview genereres fra original coldpreview

### `test_photos_batch.py`
- Best-effort: gyldige Photos oppdateres, ugyldige hashes rapporteres i respons
- Batch tags add/remove/set
- Batch rating, event, category, photographer
- Batch taken-at-offset: tidspunkt flyttes korrekt
- Batch soft delete og restore

### `test_collections.py`
- CRUD happy path
- Legg til photo-item og tekstkort
- `PUT /items` oppdaterer kun posisjon — caption røres ikke
- `PATCH /items/{id}` oppdaterer caption/title/text_content
- Batch-legg til photos (best-effort)

### `test_stacks.py`
- Opprett stack — første Photo blir automatisk coverbilde
- Legg til Photo
- Photo kan ikke tilhøre to stacker (409)
- Fjern coverbilde → neste Photo blir automatisk nytt coverbilde
- Fjern siste Photo → stack slettes automatisk
- `DELETE /stacks/{id}` løser opp alle Photos

### `test_duplicates.py`
- Duplikater listes korrekt
- Manuell sletting av duplikat-rad
- Validering fjerner rader for filer som ikke lenger finnes

---

## Reelle kamerabilder (`--real-images`)

Krever nedlastede testbilder (`make download-test-images`). Hopper over automatisk uten flagget.

| Test | Hva verifiseres |
|---|---|
| EXIF fra JPEG | `taken_at`, `camera_make`, `camera_model`, `iso` osv. |
| EXIF fra RAW | Samme felt fra RAW-masterfil |
| Hothash fra ekte bilde | Stabilt på tvers av kjøringer |

---

## Navnkonvensjon

```python
# Beskrivende navn — forteller hva som forventes, ikke bare hva som kalles
async def test_create_photographer_returns_201(client): ...
async def test_delete_event_with_children_returns_409(client): ...
async def test_add_photo_to_two_stacks_returns_409(client): ...
async def test_empty_trash_deletes_coldpreview_file(client, tmp_path): ...
async def test_batch_tags_add_reports_invalid_hashes(client): ...
```

---

## Arbeidsflyt

Tester skrives parallelt med endepunktene — ikke etter. Hvert endepunkt har tester før neste påbegynnes.

```sh
# Kjør alle syntetiske tester
make test

# Kjør alle tester inkl. kamerabilder
make test-all

# Én testfil under utvikling
cd backend && uv run pytest tests/api/test_photos.py -v

# Én enkelt test
cd backend && uv run pytest tests/api/test_photos.py::test_soft_delete_filters_from_list -v
```
