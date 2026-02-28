# Distribusjon og multi-maskin arkitektur

Dette dokumentet beskriver arkitekturen for distribusjon av Hotprevue til vanlige brukere
på Windows, samt valgfri synkronisering mellom maskiner.

---

## Overordnet prinsipp

**Lokal installasjon er alltid primær.** Appen fungerer 100% uten nettilgang og uten sentral
server. Synkronisering er tilvalg.

```
[Lokal maskin A]          [Lokal maskin B]
  Nettleser (React)         Nettleser (React)
  Python-backend            Python-backend
  PostgreSQL (pgserver)     PostgreSQL (pgserver)
  Coldpreviews (lokal)      Coldpreviews (lokal)
        │                         │
        └──── synk (valgfritt) ────┘
```

**Regler:**
- Registrering skjer alltid lokalt — originalfiler er store og må behandles der de er.
- Backend leser originalfiler direkte fra filsystemet — ingen opplasting fra frontend.
- Synk er manuelt utløst, én vei: lokal → sentral.
- Originalfiler er brukerens ansvar. Backend lagrer kun stier.

---

## Distribusjon

### Primær: zip-pakke (~16 MB)

Enkleste distribusjon. Inneholder:

| Innhold | Teknologi |
|---------|-----------|
| `backend/` | FastAPI-kildekode + avhengigheter via uv |
| `frontend/` | Bygd React-app (statiske filer) |
| `uv.exe` | Python-kjøretid og pakkehåndtering |
| `Hotprevue.bat` | Startskript |

Brukeren dobbeltklikker på `Hotprevue.bat`. Backend starter, nettleser åpnes automatisk på
`http://localhost:8000`. Backend serverer frontend som statiske filer.

**Byggprosess:**
```sh
# 1. Bygg frontend (WSL)
make build-web   # → frontend/dist/

# 2. Pakk zip (Windows PowerShell)
powershell -ExecutionPolicy Bypass -File build-zip.ps1
# Resultat: Hotprevue-x.y.z.zip
```

### Alternativ: NSIS-installer (~200 MB)

Inneholder en PyInstaller-pakket backend-binær i stedet for kildekode + uv.

```powershell
# 1. Bygg backend-binær (Windows PowerShell)
cd backend
$env:UV_PROJECT_ENVIRONMENT = ".venv-win"
uv run --python 3.12 --with pyinstaller pyinstaller hotprevue.spec

# 2. Pakk og bygg installer
powershell -ExecutionPolicy Bypass -File build-installer.ps1
# Resultat: Hotprevue Setup x.y.z.exe
```

---

## Datalagring

Datakataloger bestemmes automatisk av backend via `platformdirs`:

| Plattform | PostgreSQL-data | Coldpreviews |
|-----------|-----------------|--------------|
| Windows   | `%LOCALAPPDATA%\Hotprevue\pgdata\` | `%LOCALAPPDATA%\Hotprevue\coldpreviews\` |
| Linux     | `~/.local/share/Hotprevue/pgdata/` | `~/.local/share/Hotprevue/coldpreviews/` |

Override med `DATA_DIR`.

I tillegg lagres `machine_id` (UUID) i `DATA_DIR/machine_id`. Denne filen
overlever database-rekreasjon og synkronisering, og brukes til å identifisere maskinen.

---

## Per-maskin identitet

`machines`-tabellen har én rad per maskin som har brukt databasen.
`machine_id` genereres lokalt ved første oppstart og lagres i en fil — uavhengig av
databasen, slik at identiteten er stabil selv om databasen flyttes eller gjenopprettes.

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
| system_settings  | ❌ | global per installasjon |
| machines         | ❌ | per-maskin |

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
Header: X-Machine-Id: <uuid>
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

## Kritiske filer

| Fil | Rolle |
|-----|-------|
| `backend/main.py` | Oppstart, migrasjoner, maskinregistrering |
| `backend/core/local_setup.py` | pgserver-init, platformdirs, machine_id-fil |
| `backend/core/config.py` | Settings, DATABASE_URL, COLDPREVIEW_DIR |
| `backend/database/session.py` | Engine og SessionLocal |
| `backend/alembic/env.py` | Leser DATABASE_URL fra env |
| `build-zip.ps1` | Pakker zip-distribusjon |
| `build-installer.ps1` | Pakker NSIS-installer |
