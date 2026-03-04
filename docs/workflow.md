# Hotprevue — arbeidsflyt

Referansedokument for utviklingsøkter. Dekker to uavhengige arbeidsflyter:
**del 1** er utvikling og testing på serveren, **del 2** er versjonshåndtering og deployment.

---

## Server og tilgang

| | |
|---|---|
| Hostname | `utvikler` |
| LAN-adresse | `192.168.1.166` |
| Tailscale | `100.105.180.3` |
| Repo | `/home/kjell/hotprevue` |
| Data (backend) | `~/.local/share/Hotprevue/` |

---

---

# Del 1 — Utvikling på serveren

## Starte en økt

Du trenger **to terminaler** i `/home/kjell/hotprevue`:

**Terminal 1 — backend:**
```bash
make dev-backend
```
Starter FastAPI + pgserver (PostgreSQL). Lytter på `0.0.0.0:8000`.

**Terminal 2 — frontend:**
```bash
make dev-frontend
```
Starter Vite dev-server med hot-reload. Lytter på `0.0.0.0:5173`.
Proxyer alle API-kall automatisk til backend på port 8000.

**Åpne i Windows-nettleser:**
```
http://192.168.1.166:5173
```
eller via Tailscale: `http://100.105.180.3:5173`

## Stoppe en økt

`Ctrl+C` i begge terminaler. pgserver rydder opp automatisk.

---

## Testdata og bilder

Testbilder ligger på serveren og nås direkte av backend via filsystemet.
Bruk `/system/browse`-dialogen i UI-et for å navigere og registrere bilder.

```bash
# Last ned et lite sett testbilder (brukes i automatiske tester):
make download-test-images

# Større sett:
make download-test-images-full
```

> **Merk:** «Velg…»-knappen i UI-et (tkinter-dialog) fungerer ikke på serveren
> fordi det ikke er noen skjerm. Bruk nettleserdialogen (`/system/browse`) i stedet —
> den fungerer like bra for utvikling og test.

---

## Kjøre tester

```bash
# Alle tester:
make test

# Én enkelt testfil:
cd backend && uv run pytest tests/path/to/test_file.py -v

# Én enkelt test:
cd backend && uv run pytest tests/path/to/test_file.py::test_function_name -v
```

---

## Viktige begrensninger under utvikling

| Begrensning | Årsak |
|---|---|
| `--reload` virker ikke | pgserver starter PostgreSQL som subprocess; socket-konflikter ved reload |
| Tkinter-dialog feiler | Ingen `DISPLAY`-miljøvariabel på headless server |
| `frontend/dist/` committes ikke | Ligger i `.gitignore`; bygges av GitHub Actions ved release |

---

## Nyttige stier og filer

| Fil/katalog | Innhold |
|---|---|
| `backend/api/` | API-ruter (FastAPI) |
| `backend/services/` | Forretningslogikk |
| `frontend/src/features/` | React-features |
| `frontend/src/pages/` | Sider |
| `frontend/src/api/` | Alle API-kall (aldri `fetch()` direkte i komponenter) |
| `~/.local/share/Hotprevue/` | Database, coldpreviews, machine_id (serverens data) |

---

---

# Del 2 — Versjonshåndtering og deployment

## Normal git-arbeidsflyt

```bash
# Se hva som er endret:
git status
git diff

# Stage spesifikke filer (aldri git add -A):
git add backend/api/photos.py frontend/src/features/gallery/GalleryGrid.tsx

# Commit:
git commit -m "Kort beskrivelse av hva og hvorfor"

# Push til GitHub:
git push
```

**Ikke commit:**
- `.venv/`, `frontend/dist/`, `data/`, `.env` — håndteres av `.gitignore`
- Store binærfiler eller testbilder

---

## Lage en release

En release publiserer zip-pakker for Windows og Linux til GitHub Releases,
og oppdaterer nettsiden automatisk.

```bash
# 1. Kontroller at alt er pushet:
git status
git push

# 2. Sett tag og push:
git tag v0.1.5
git push origin v0.1.5
```

GitHub Actions kjører automatisk og:
- Bygger frontend
- Laster ned `uv.exe` (Windows) og `uv` (Linux) fra Astral
- Setter sammen to zip-pakker
- Publiserer releasen med begge filene vedlagt
- Oppdaterer nettsiden med ny versjon og nedlastingslenke

**Følg med:** `github.com/kjelkols/hotprevue/actions`

**Nedlastinger:** `github.com/kjelkols/hotprevue/releases`

---

## Manuell bygging av zip-pakker (uten release)

For å teste pakkeresultatet lokalt, eller sende en pakke uten å lage en offisiell release:

```bash
make build-zip-windows   # → Hotprevue-x.y.z-windows.zip
make build-zip-linux     # → Hotprevue-x.y.z-linux.zip
make build-zip-all       # → begge (bygger frontend én gang, pakker to ganger)
```

Versjonsnummer hentes fra siste git-tag. Zip-filene havner i `/home/kjell/hotprevue/`.

---

## Versjonsnummerering

Formatet er `v MAJOR.MINOR.PATCH`:

| Type endring | Eksempel |
|---|---|
| Bugfix / liten forbedring | `v0.1.4` → `v0.1.5` |
| Ny funksjonalitet | `v0.1.x` → `v0.2.0` |
| Større arkitekturendring | `v0.x.x` → `v1.0.0` |

Siste release: `v0.1.4`

---

## Dokumenter og kodeadministrasjon

### Kjernedokumenter

| Fil | Formål | Oppdateres når |
|---|---|---|
| `CLAUDE.md` | Instruksjoner til AI-assistenten | Arkitektur eller regler endres |
| `docs/workflow.md` | Dette dokumentet | Arbeidsflyt endres |
| `docs/deployment.md` | Detaljert releaseprosess | Release-mekanismen endres |
| `docs/program-distribution.md` | Spesifikasjon for cross-platform bygg | Nye plattformer legges til |

### Spesifikasjoner og beslutninger

| Katalog | Innhold |
|---|---|
| `docs/spec/` | Tekniske spesifikasjoner (datamodell, API, arkitektur) |
| `docs/decisions/` | ADR-er — beslutninger og begrunnelser (nummerert `001-`, `002-`, …) |
| `docs/vision/` | Overordnede mål og retning |

### Nye ADR-er

Når en viktig teknisk beslutning tas:
```
docs/decisions/008-kort-navn.md
```
Beskriv: hva ble valgt, hvilke alternativer ble vurdert, og hvorfor.

---

## Nettside og distribusjon

| Ressurs | URL |
|---|---|
| GitHub-repo | `github.com/kjelkols/hotprevue` |
| Actions (CI/CD) | `github.com/kjelkols/hotprevue/actions` |
| Releases | `github.com/kjelkols/hotprevue/releases` |
| Nettside (GitHub Pages) | Oppdateres automatisk ved release |

---

## Sjekkliste før release

- [ ] Alle endringer er committed og pushet
- [ ] Tester passerer: `make test`
- [ ] Manuell test i Windows-nettleser mot dev-server
- [ ] `CHANGELOG.md` og/eller ADR-er oppdatert ved behov
- [ ] Versjonsnummer er valgt (`git tag vX.Y.Z`)
