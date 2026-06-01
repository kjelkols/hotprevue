# Deployment — Hotprevue

## Konsept

Alt skjer fra lokal maskin til server — serveren trenger ikke git.

```
Lokal maskin
  ↓ dev-local.sh     — utvikling og testing
  ↓ pytest           — tester kjøres lokalt
  ↓ deploy.sh        — bygg, send, migrer, restart
Produksjonsserver
```

---

## Lokal utvikling

Start alle tre prosesser i egne terminaler:

```bash
bash scripts/dev-local.sh
```

Stopp alle prosesser:

```bash
bash scripts/dev-stop.sh
```

Prosessene som kjøres:

| Terminal   | Kommando                        | Port |
|------------|---------------------------------|------|
| Backend    | uvicorn main:app --reload       | 8000 |
| Agent      | uvicorn agent.main:app --reload | 8002 |
| Frontend   | vite dev                        | 5173 |

Dataene lagres i `~/.local/share/hotprevue/` (coldpreviews + database `hotprevue`).

---

## Server-oppsett (én gang)

Kjøres én gang når en ny produksjonsserver skal settes opp:

```bash
scp scripts/setup-server.sh kjell@server:~/
ssh kjell@server sudo bash ~/setup-server.sh
```

### Hva skriptet gjør

| Hva | Hvor |
|-----|------|
| Installerer `uv` | `/usr/local/bin/uv` |
| Installerer PostgreSQL | system |
| Oppretter PostgreSQL-bruker `kjell` | peer auth, ingen passord |
| Oppretter database `hotprevue` | PostgreSQL |
| Oppretter applikasjonskatalog | `/opt/hotprevue/backend/`, `/opt/hotprevue/frontend/dist/` |
| Oppretter datakatalog | `/var/lib/hotprevue/coldpreviews/` |
| Oppretter `.env` | `/opt/hotprevue/backend/.env` |
| Registrerer systemd-tjeneste | `/etc/systemd/system/hotprevue.service` |
| Legger til sudoers-regel | `/etc/sudoers.d/hotprevue` |

Etter oppsett er serveren klar, men tom. Kjør `deploy.sh` for å sende koden.

---

## Deploy

```bash
bash scripts/deploy.sh kjell@server
```

### Hva skriptet gjør

1. **Kjører backend-tester** — avbryter hvis noe feiler
2. **Bygger frontend** lokalt med byggnummer
3. **Sender backend** — Python-kildekode via tar over SSH (uten `.venv`, `__pycache__` osv.)
4. **Sender frontend** — bygd `dist/` via tar over SSH
5. **På server:** `uv sync`, `alembic upgrade head`, `systemctl restart hotprevue`

---

## Filstruktur på server

```
/opt/hotprevue/
├── backend/                ← Python-kildekode (sendt av deploy.sh)
│   ├── .env                ← Miljøvariabler (opprettet av setup-server.sh, aldri overskrevet)
│   └── .venv/              ← Virtuelt miljø (opprettet av uv sync)
└── frontend/
    └── dist/               ← Bygd frontend (sendt av deploy.sh)

/var/lib/hotprevue/
└── coldpreviews/           ← Lagrede forhåndsvisninger
```

---

## Miljøvariabler på server

`/opt/hotprevue/backend/.env`:

```
DATABASE_URL=postgresql+psycopg2:///hotprevue
COLDPREVIEW_DIR=/var/lib/hotprevue/coldpreviews
HOTPREVUE_FRONTEND_DIR=/opt/hotprevue/frontend/dist
HOTPREVUE_OPEN_BROWSER=false
```

---

## Nyttige kommandoer på server

```bash
sudo systemctl status hotprevue
sudo journalctl -u hotprevue -f
sudo systemctl restart hotprevue
```
