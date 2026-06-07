# Teststrategi

## To nivåer

### Unit-tester
Rene funksjoner uten database. Lynraske, ingen eksterne avhengigheter.

Dekker:
- `utils/exif.py` — EXIF-uttrekk og felt-mapping
- `utils/previews.py` — preview-generering og hothash-beregning

### Integrasjonstester
HTTP-klient mot ekte PostgreSQL-testdatabase. Tester hele stakken fra API til database.

**Hvorfor ikke mocke databasen?**
FK-constraints, kaskadesletting og Alembic-migreringslogikk testes kun mot ekte schema. Testcontainers spinner opp PostgreSQL automatisk om Docker er tilgjengelig — ellers brukes lokal testdatabase.

---

## Oppsett (lokal PostgreSQL)

Testene kjøres mot en separat database slik at dev-dataene aldri berøres.

```sh
# Opprett testdatabasen (én gang per maskin):
createdb hotprevue_test
```

Scriptet setter `TEST_DATABASE_URL` til `postgresql+psycopg2:///hotprevue_test?host=/run/postgresql` automatisk.

Alternativt med Docker: testcontainers spinner opp `postgres:16-alpine` automatisk dersom Docker er tilgjengelig — ingen manuell oppsett nødvendig.

---

## Kjøre tester

```sh
# Alle tester
bash scripts/run-tests.sh

# Én testfil
bash scripts/run-tests.sh tests/api/test_photos.py -v

# Én enkelt test
bash scripts/run-tests.sh tests/api/test_photos.py::test_list_photos -v

# Med ekte kamerabilder (krever make download-test-images)
bash scripts/run-tests.sh --real-images
```

---

## Testinfrastruktur

`backend/tests/conftest.py` tilbyr:

| Fixture | Scope | Beskrivelse |
|---|---|---|
| `database_url` | session | `TEST_DATABASE_URL` env-var eller testcontainers PostgreSQL |
| `run_migrations` | session, autouse | Kjører `alembic upgrade head` mot testdatabasen |
| `clean_db` | function, autouse | Truncater alle datatabeller mellom tester |
| `client` | function | `TestClient` koblet til test-DB via dependency override |
| `db` | function | Direkte DB-sesjon for seeding av testdata |
| `default_kind_id` | function | UUID til standard-kind (seedet av migrasjon) |
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
    test_events.py
    test_photographers.py
    test_photos.py
    test_real_images.py
    test_registration.py
    test_system.py
```

---

## Navnkonvensjon

```python
def test_create_event(client): ...
def test_delete_photographer_with_photos_fails(client): ...
def test_check_hothashes_mixed(client): ...
```

Beskrivende navn som forteller hva som forventes, ikke bare hva som kalles.

---

## Arbeidsflyt

Tester skrives parallelt med endepunktene — ikke etter. Hvert endepunkt har tester før neste påbegynnes.

---

## Reelle kamerabilder (`--real-images`)

Krever nedlastede testbilder (`make download-test-images`). Hopper over automatisk uten flagget.

Tester i `test_real_images.py` verifiserer EXIF-uttrekk, RAW-master-logikk og hothash-stabilitet mot ekte kamerafiler.
