# Deployment — Hotprevue

## Miljøoversikt

```
┌─────────────────────────────────────────────────────────────────────┐
│  beelink  (lokal utviklingsmaskin)                                  │
│  OS: Ubuntu 24.04 LTS · Tailscale-navn: beelink                    │
│                                                                     │
│  Rolle: utvikling, manuell testing, kjøre tester                   │
│                                                                     │
│  Backend (dev):   http://localhost:8000    (make dev-backend)      │
│  Agent (dev):     http://localhost:8002    (dev-local.sh)          │
│  Frontend (dev):  http://beelink:5173      (make dev-frontend)     │
│  Database:        PostgreSQL via Unix-socket /run/postgresql        │
│    hotprevue       — aktiv dev-/testdatabase (13 500+ bilder)      │
│    hotprevue_test  — pytest-database (tørket mellom testøkter)     │
│  Coldpreviews:    ~/.local/share/hotprevue/coldpreviews/           │
│  Git-remote:      git@github.com:kjelkols/hotprevue.git            │
└─────────────────────────────────────────────────────────────────────┘
              │  make deploy-vm  /  bash scripts/deploy.sh
              ▼
┌─────────────────────────────────────────────────────────────────────┐
│  hotprevue  (produksjonsserver)                                     │
│  OS: Ubuntu 26.04 LTS · VM på Proxmox · Tailscale-navn: hotprevue │
│                                                                     │
│  Rolle: produksjon — kjøres kontinuerlig, eksponert via Tailscale  │
│                                                                     │
│  Backend:         http://hotprevue:8000  (port 8000, 0.0.0.0)     │
│  Systemd-tjeneste: hotprevue.service                               │
│  App-kode:        /opt/hotprevue/backend/                          │
│  Frontend (dist): /opt/hotprevue/frontend/dist/                    │
│  Coldpreviews:    /var/lib/hotprevue/coldpreviews/                 │
│  .env:            /opt/hotprevue/backend/.env                      │
│  Database:        PostgreSQL via Unix-socket, database hotprevue   │
│  DB URL:          postgresql+psycopg2:///hotprevue                 │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Databaser på beelink

| Navn | Bruk | Tilkobling |
|------|------|------------|
| `hotprevue` | Aktiv dev-database — reelle bilder | `postgresql+psycopg2:///hotprevue?host=/run/postgresql` |
| `hotprevue_test` | Pytest — tørkes og migreres automatisk | `postgresql+psycopg2:///hotprevue_test?host=/run/postgresql` |

Opprett testdatabase (én gang per maskin):
```bash
createdb hotprevue_test
```

---

## Lokal agent (klientprosess)

Agenten er en FastAPI-app (`client/agent/`) som kjører på **port 8002** på klientmaskinen.
Den er bindeleddet mellom nettleseren og det lokale filsystemet — nettleseren har ikke
filsystemtilgang, så alle operasjoner mot originalfiler går gjennom agenten.

**Hva agenten gjør:**

| Ruter | Ansvar |
|-------|--------|
| `/browse` | Blar i lokalt filsystem, filtrerer på kjente bildeformater (JPEG, RAW, HEIC m.fl.) |
| `/scan` | Scanner en katalog og returnerer bildegrupper med companion-filer (RAW + JPEG + XMP) |
| `/prescan` | Bakgrunnsscanning med SQLite-cache — genererer hotpreview og leser EXIF uten at bruker venter |
| `/process` | Prosesserer ett bilde: hashing (hothash), EXIF-utlesing, generering av hotpreview og coldpreview, kvalitetsmåling |
| `/files` | Lokale filoperasjoner: flytt bildegruppe, opprett katalog, roter bilde (EXIF eller XMP sidecar) |
| `/copy` | Kopierer filer fra minnekort til permanent lagring, kjører i bakgrunn med polling |

Agenten sender aldri originalfiler til backend — kun den prosesserte metadataen
(hothash, base64-previews, EXIF) sendes videre til backend-API-et på port 8000.

Startes via `dev-local.sh` (sammen med backend og frontend):
```bash
bash scripts/dev-local.sh
```

Eller manuelt:
```bash
cd client && uv run uvicorn agent.main:app --reload --port 8002
```

---

## Lokal utvikling

```bash
# Start alle tre prosesser (backend + agent + frontend) i egne gnome-terminal-vinduer
bash scripts/dev-local.sh

# Eller start hver for seg:
make dev-backend      # port 8000
make dev-frontend     # port 5173
cd client && uv run uvicorn agent.main:app --reload --port 8002
```

Frontend dev-serveren (`http://beelink:5173`) er tilgjengelig på nettverket og
kan nås fra en Windows-nettleser via Tailscale-IP.

Lokal data: `~/.local/share/hotprevue/`

Kjør migrasjoner mot lokal dev-database:
```bash
bash scripts/alembic-upgrade.sh
```

---

## Kjøre tester

```bash
# Alle tester
bash scripts/run-tests.sh

# Én testfil
bash scripts/run-tests.sh tests/api/test_photos.py

# Én test
bash scripts/run-tests.sh tests/api/test_photos.py::test_name
```

Testene kjøres mot `hotprevue_test`-databasen. Alembic migrerer skjemaet automatisk
ved teststart — ingen manuell opprydding nødvendig.

---

## Deploy til produksjon

### Normal workflow

```bash
bash scripts/release.sh patch   # v0.1.4 → v0.1.5  (feilrettinger, små endringer)
bash scripts/release.sh minor   # v0.1.4 → v0.2.0  (nye funksjoner)
bash scripts/release.sh major   # v0.1.4 → v1.0.0  (store endringer)
```

`release.sh` gjør i rekkefølge:
1. Leser siste git-tag og beregner ny versjon
2. Kjører `pytest` — avbryter hvis tester feiler
3. Oppretter og pusher ny git-tag (GitHub Actions bygger release-zip automatisk)
4. Bygger frontend med versjonsnummer
5. Sender backend og frontend til server via tar over SSH
6. På server: `uv sync`, `alembic upgrade head`, `systemctl restart hotprevue`

### Direkte deploy uten versjonsbump

Brukes unntaksvis når du vil sende en rask rettelse uten å øke versjonsnummeret:

```bash
bash scripts/deploy.sh kjell@hotprevue
```

Kjører tester, bygger og deployer — men oppretter ingen ny tag.

### Rask frontend-deploy (uten tester)

Kun for rene UI-endringer når tester er kjørt manuelt:

```bash
make deploy-vm
# Målserver leses fra .vm-host (inneholder: hotprevue)
```

Merk: kjører ikke tester og ikke migrasjoner. Migrer manuelt ved behov:
```bash
ssh kjell@hotprevue "cd /opt/hotprevue/backend && uv run alembic upgrade head"
```

---

## Første gangs server-oppsett

Kjøres én gang når en ny server skal settes opp (krever root-tilgang):

```bash
scp scripts/setup-server.sh kjell@hotprevue:~/
ssh kjell@hotprevue sudo bash ~/setup-server.sh
```

Skriptet installerer: PostgreSQL, uv, oppretter kataloger, `.env`, systemd-tjeneste
og sudoers-regel for `systemctl restart hotprevue`.

---

## Kopiere database og bilder fra beelink til produksjon

Brukes når produksjonsserver skal oppdateres med data fra beelink
(f.eks. etter første deploy eller ved større opprydding).

```bash
# 1. Dump database på beelink
pg_dump -h /run/postgresql hotprevue > /tmp/hotprevue-dump.sql

# 2. Kopier dump og alle coldpreviews til server
rsync /tmp/hotprevue-dump.sql kjell@hotprevue:/tmp/
rsync -av --delete \
    ~/.local/share/hotprevue/coldpreviews/ \
    kjell@hotprevue:/var/lib/hotprevue/coldpreviews/

# 3. Erstatt database på server
ssh kjell@hotprevue "sudo systemctl stop hotprevue && \
    sudo -u postgres psql -c 'DROP DATABASE IF EXISTS hotprevue; CREATE DATABASE hotprevue;' && \
    psql hotprevue < /tmp/hotprevue-dump.sql"

# 4. Migrer til nyeste skjema og start tjeneste
ssh kjell@hotprevue "cd /opt/hotprevue/backend && \
    uv run alembic upgrade head && \
    sudo systemctl start hotprevue"
```

---

## Filstruktur på produksjonsserver

```
/opt/hotprevue/
├── backend/
│   ├── .env                ← miljøvariabler (aldri overskrevet av deploy)
│   ├── .venv/              ← virtuelt miljø (opprettet av uv sync)
│   └── (kildekode)
└── frontend/
    └── dist/               ← bygd React-app

/var/lib/hotprevue/
└── coldpreviews/           ← forhåndsvisninger, hash-basert katalogstruktur
                               (ab/cd/abcd1234….jpg)
```

`.env` på produksjonsserver:
```
DATABASE_URL=postgresql+psycopg2:///hotprevue
COLDPREVIEW_DIR=/var/lib/hotprevue/coldpreviews
HOTPREVUE_FRONTEND_DIR=/opt/hotprevue/frontend/dist
HOTPREVUE_OPEN_BROWSER=false
```

---

## Nyttige kommandoer på server

```bash
# Status og logger
sudo systemctl status hotprevue
sudo journalctl -u hotprevue -f
sudo journalctl -u hotprevue --since "1 hour ago"

# Restart
sudo systemctl restart hotprevue

# Manuell migrering
cd /opt/hotprevue/backend && uv run alembic upgrade head

# Sjekk gjeldende migreringsversjon
cd /opt/hotprevue/backend && uv run alembic current

# Database-tilkobling
psql hotprevue
```
