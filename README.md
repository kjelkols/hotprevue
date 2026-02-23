# Hotprevue

Bildehåndteringssystem for fotografer. Indekserer og organiserer store bildesamlinger uten å flytte eller endre originalfilene — kun metadata og forhåndsvisninger lagres.

## Kom i gang

**Krav:** Docker Desktop

```bash
git clone https://github.com/kjelkols/hotprevue.git
cd hotprevue
docker compose up
```

API er tilgjengelig på `http://localhost:8000` og interaktiv dokumentasjon på `http://localhost:8000/docs`.

## Funksjoner

- **Registrering** — leser EXIF, genererer hotpreview (150×150 px, lagret i DB) og coldpreview (opptil 1200 px, lagret på disk)
- **Events** — grupper bilder etter hendelse, med støtte for hierarki (parent/child)
- **Tagging og rating** — fritekst-tags og stjerneskala 1–5
- **Søk og filtrering** — filtrer på event, tags, rating og filnavn
- **Ingen filflytting** — originalfiler røres aldri

## API-oversikt

| Metode | Sti | Beskrivelse |
|--------|-----|-------------|
| `POST` | `/images/register` | Registrer bilde fra filsti |
| `GET` | `/images` | List bilder (filtrering via query-params) |
| `GET` | `/images/{hothash}` | Hent ett bilde |
| `PATCH` | `/images/{hothash}` | Oppdater rating, tags, event |
| `DELETE` | `/images/{hothash}` | Slett metadata og coldpreview |
| `GET` | `/images/{hothash}/coldpreview` | Last ned coldpreview-fil |
| `POST` | `/events` | Opprett event |
| `GET` | `/events` | List events med bildeantall |
| `GET` | `/events/{id}` | Hent event med bilder |
| `PATCH` | `/events/{id}` | Oppdater event |
| `DELETE` | `/events/{id}` | Slett event (bilder beholdes) |

## Arkitektur

```
backend/        FastAPI · SQLAlchemy async · Alembic · Pillow
frontend/       (kommer)
tests/          pytest · httpx · testcontainers (PostgreSQL)
```

Databasen er PostgreSQL. Coldpreviews lagres i `$COLDPREVIEW_DIR/<ab>/<cd>/<hothash>.jpg`.

## Utvikling

```bash
# Kjør tester (krever Docker)
cd backend
uv run pytest ../tests/ -v

# Start server lokalt med hot-reload
docker compose up
```

Miljøvariabler konfigureres i `backend/.env` (se `.env.example`).
