# Distribusjon og multi-maskin arkitektur

Dette dokumentet beskriver arkitekturen for distribusjon av Hotprevue til vanlige brukere
på Windows, macOS og Linux, samt valgfri sentral server for familiedeling.

---

## Overordnet prinsipp

**Lokal installasjon er alltid primær.** Appen fungerer 100% uten nettilgang og uten sentral
server. Sentral server og synkronisering er tilvalg.

```
[Lokal maskin A]          [Lokal maskin B]
  Electron-app              Electron-app
  Python-backend            Python-backend
  PostgreSQL (pgserver)     PostgreSQL (pgserver)
  Coldpreviews (lokal)      Coldpreviews (lokal)
        │                         │
        └──── synk (valgfritt) ────┘
                     │
              [Sentral server]
              Python-backend
              PostgreSQL (full)
              Coldpreviews (mottatt)
```

**Regler:**
- Registrering skjer alltid lokalt — originalfiler er store og må behandles der de er.
- Sentral server aggregerer, eier ingenting selv.
- Synk er manuelt utløst, én vei: lokal → sentral.
- Originalfiler er brukerens ansvar. Backend lagrer kun stier.

---

## Komponenter

### Lokal installasjon

En enkeltstående native app-installer. Inneholder:

| Komponent | Teknologi | Notat |
|-----------|-----------|-------|
| Frontend | Electron + React | UI |
| Backend | FastAPI (Python, PyInstaller-bundle) | API |
| Database | PostgreSQL via pgserver | Ingen Docker |
| Bildebehandling | Pillow (innebygd i backend-bundle) | Hotpreview, coldpreview |

**pgserver** er PostgreSQL 16 pakket som Python-wheel (~13 MB). Starter automatisk
når backenden starter (~1s etter første initialisering). Stopper når appen avsluttes.
Ingen Windows-tjeneste, ingen admin-rettigheter, ingen separat installasjon.

### Sentral server

Docker Compose-basert, identisk med dagens utviklingsmiljø. Kjøres på NAS, VPS eller
hvilken som helst Linux-maskin. Ingen endringer i eksisterende oppsett.

---

## Datalagring

### Lokal (pgserver)

Datakataloger bestemmes automatisk av backend via `platformdirs`:

| Plattform | PostgreSQL-data | Coldpreviews |
|-----------|-----------------|--------------|
| Windows   | `%LOCALAPPDATA%\Hotprevue\pgdata\` | `%LOCALAPPDATA%\Hotprevue\coldpreviews\` |
| Linux     | `~/.local/share/hotprevue/pgdata/` | `~/.local/share/hotprevue/coldpreviews/` |
| macOS     | `~/Library/Application Support/hotprevue/pgdata/` | `...hotprevue/coldpreviews/` |

Settes via `DATABASE_URL` og `COLDPREVIEW_DIR` env-variabler, som i dag.
I lokal modus beregnes verdiene automatisk og injiseres før backend-imports.

### Sentral server

PostgreSQL via Docker-volum. Coldpreviews mottas fra lokale maskiner og lagres på disk.
Identisk med dagens oppsett.

---

## Per-maskin identitet

`system_settings.installation_id` (UUID, allerede implementert) identifiserer hver
installasjon unikt. Brukes til å tagge all data som synkroniseres.

`system_settings` synkroniseres **ikke** — hver maskin har sine egne innstillinger.

Sentral server får en ny tabell for å spore tilkoblede maskiner:

```
registered_machines
  installation_id  UUID        PK
  machine_name     TEXT        brukergitt navn ("Kjells laptop")
  first_sync_at    TIMESTAMP
  last_sync_at     TIMESTAMP
```

---

## Første-gangs oppsett (Electron UI)

Ny `WelcomePage` vises ved første oppstart:

```
┌──────────────────────────────────────┐
│        Velkommen til Hotprevue       │
│                                      │
│  [ Kom i gang lokalt ]               │
│    Kjør på denne maskinen            │
│                                      │
│  [ Koble til sentral server ]        │
│    NAS, VPS eller felles server      │
└──────────────────────────────────────┘
```

**Lokal modus:** Electron starter Python-backend automatisk. `backendUrl` settes til
`http://localhost:8000`. Brukeren trenger ikke konfigurere noe.

**Sentral server-modus:** Brukeren skriver inn URL. Ingen lokal backend startes av Electron.

Etter oppsett: innstillingssiden lar brukeren legge til sentral server for synk.

---

## Synk-strategi

### Prinsipp: lokal er master, sentral er speil

Alle endringer skjer lokalt. Sentral mottar og lagrer, men sender aldri tilbake.
Ingen konflikthåndtering nødvendig — `hothash` er innholdsadressert, samme bilde
gir alltid samme ID uavhengig av hvilken maskin som registrerte det.

### Hva synkroniseres

| Tabell           | Synkes | Notat |
|------------------|--------|-------|
| photos           | ✅ | inkl. `hotpreview_b64` |
| image_files      | ✅ | lokale filstier, nyttig for sporing |
| input_sessions   | ✅ | |
| events           | ✅ | |
| collections      | ✅ | |
| collection_items | ✅ | |
| photo_corrections| ✅ | |
| coldpreviews     | ✅ | filer lastes opp etter metadata |
| system_settings  | ❌ | per-maskin |

### Synk-sporing

Ny tabell `sync_log` i lokal database:

```
sync_log
  id           UUID        PK
  entity_type  TEXT        'photo' | 'event' | 'collection' | ...
  entity_id    UUID
  target_url   TEXT        URL til sentral server
  synced_at    TIMESTAMP
```

Synk-modulen sjekker hvilke rader som mangler i `sync_log` for et gitt mål og pusher disse.
Operasjonen er idempotent og trygg å kjøre på nytt.

### Synk-protokoll

```
POST {central_url}/api/sync/receive
Header: X-Installation-Id: <uuid>
Body (JSON):
  {
    machine_name: "Kjells laptop",
    photos: [...],
    image_files: [...],
    input_sessions: [...],
    events: [...],
    collections: [...],
    collection_items: [...]
  }

Response: { received: N, skipped_duplicates: M }
```

Deretter for hver coldpreview som mangler på sentral:
```
POST {central_url}/api/sync/coldpreview/{hothash}
Body: JPEG-bytes (multipart)
```

Sentral server bruker `INSERT ... ON CONFLICT (hothash) DO NOTHING` — duplikater ignoreres.

---

## Implementasjonsfaser

### Fase 1 — pgserver (fjerner Docker-krav lokalt)

**Endrede filer:**
- `backend/pyproject.toml` — legg til `pgserver>=0.4`, `platformdirs>=4.0`
- `backend/main.py` — pgserver-init FØR alle andre imports, via env-var `HOTPREVUE_LOCAL`
- `backend/core/config.py` — legg til `local_mode: bool`, `local_data_dir: str`
- `backend/.env.example` — fiks bug: asyncpg → psycopg2

**Ny fil:**
- `backend/core/local_setup.py` — isolerer pgserver-logikk og platformdirs-beregning

**Oppstartsekvens i lokal modus:**
```python
# backend/main.py — må stå øverst, før andre imports
if os.environ.get("HOTPREVUE_LOCAL"):
    from core.local_setup import setup_local_environment
    setup_local_environment()  # setter DATABASE_URL og COLDPREVIEW_DIR
```

Alembic-migrasjoner kjøres programmatisk i `lifespan()` i lokal modus
(i dag kjøres de kun via Docker-kommando).

**Verifisering:** `HOTPREVUE_LOCAL=true uv run uvicorn main:app` starter uten Docker.

---

### Fase 2 — Electron styrer backend-prosessen

**Endrede filer:**
- `frontend/electron/main.ts` — spawn/kill Python-prosess, auto-sett `backendUrl`
- `frontend/src/App.tsx` — håndter lokal modus (ingen URL-konfig nødvendig)

**Ny fil:**
- `frontend/src/pages/WelcomePage.tsx` — erstatter `SetupPage` for lokal modus

**Backend-prosess i Electron:**
```typescript
// Utvikling
spawn('uv', ['run', 'uvicorn', 'main:app', '--host', '0.0.0.0'], {
  cwd: backendDir,
  env: { ...process.env, HOTPREVUE_LOCAL: '1' }
})

// Produksjon
spawn(path.join(process.resourcesPath, 'backend', 'hotprevue'), [], {
  env: { ...process.env, HOTPREVUE_LOCAL: '1' }
})

app.on('quit', () => backendProcess.kill())
```

**Verifisering:** Electron-appen starter backend automatisk, `/health` svarer OK.

---

### Fase 3 — PyInstaller (pakker Python-backend)

**Ny fil:** `backend/hotprevue.spec`

```python
from PyInstaller.utils.hooks import collect_data_files

datas = [
    *collect_data_files('pgserver'),  # PostgreSQL-binærfiler (~13 MB)
    ('alembic/', 'alembic/'),         # Migrasjonsscripts
    ('alembic.ini', '.'),
]

a = Analysis(['main.py'], datas=datas, ...)
```

**Byggkommando:**
```sh
cd backend && uv run pyinstaller hotprevue.spec
# Output: backend/dist/hotprevue/
```

**Verifisering:** `dist/hotprevue/hotprevue` med `HOTPREVUE_LOCAL=1` på maskin uten Python.

---

### Fase 4 — electron-builder (native installers)

**Endrede filer:**
- `frontend/package.json` — legg til `electron-builder` i devDeps, bygg-script

**Ny fil:** `frontend/electron-builder.yml`
```yaml
appId: no.hotprevue.app
productName: Hotprevue
extraResources:
  - from: ../backend/dist/hotprevue/
    to: backend/
win:
  target: nsis
  arch: [x64]
mac:
  target: dmg
linux:
  target: AppImage
```

**Full byggsekvens:**
```sh
cd backend  && uv run pyinstaller hotprevue.spec
cd frontend && npm run build
cd frontend && npx electron-builder
```

Resulterer i:
- Windows: `Hotprevue-Setup-x.y.z.exe`
- macOS: `Hotprevue-x.y.z.dmg`
- Linux: `Hotprevue-x.y.z.AppImage`

**Verifisering:** Installer kjøres på ren Windows-VM uten Python/Docker installert.

---

### Fase 5 — Synk-arkitektur

**Nye filer (backend):**
- `backend/models/sync.py` — `SyncLog`, `RegisteredMachine`
- `backend/api/sync.py` — `/api/sync/receive`, `/api/sync/coldpreview/{hothash}`
- `backend/services/sync_service.py` — push-logikk lokal → sentral
- `backend/alembic/versions/XXXX_add_sync_tables.py`

**Nye filer (frontend):**
- `frontend/src/features/sync/SyncPanel.tsx` — "Synkroniser nå" med fremdrift
- `frontend/src/api/sync.ts` — API-kall

**Endrede filer:**
- `backend/main.py` — inkluder sync-router
- `frontend/src/pages/SettingsPage.tsx` — synk-konfigurasjon

---

## Hva som ikke endres

- Alle eksisterende API-endepunkter
- SQLAlchemy-modeller (utover nye synk-tabeller)
- Pillow-basert bildebehandling og hothash-algoritme
- Sentral servers Docker Compose-oppsett
- `alembic/env.py` (leser allerede `DATABASE_URL` fra env)

---

## Kritiske filer

| Fil | Rolle |
|-----|-------|
| `backend/main.py` | Oppstart, pgserver-init, migrasjoner |
| `backend/core/config.py` | Settings, DATABASE_URL, COLDPREVIEW_DIR |
| `backend/core/local_setup.py` | (ny) pgserver + platformdirs-logikk |
| `backend/database/session.py` | Engine og SessionLocal — opprettes etter config |
| `backend/alembic/env.py` | Leser DATABASE_URL fra env (allerede korrekt) |
| `frontend/electron/main.ts` | Spawner backend, config-lagring |
| `frontend/src/App.tsx` | Routing, lokal vs. remote modus |
| `frontend/src/pages/WelcomePage.tsx` | (ny) Første-gangs oppsett |
