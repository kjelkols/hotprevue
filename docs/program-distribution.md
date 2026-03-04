# Hotprevue — distribusjonsspesifikasjon

Dette dokumentet er grunnlaget for implementering av cross-platform distribusjon.
Det erstatter og utvider den Windows-spesifikke flyten i `build-zip.ps1` og `docs/deployment.md`.

---

## Implementeringsstatus

| Plattform | Status | Kommentar |
|---|---|---|
| Windows x64 | **Implementeres nå** | GitHub Actions eksisterer, Makefile-mål mangler |
| Linux x64 | **Implementeres nå** | Ny plattform, enkelt |
| macOS | **Utsatt** | Dokumentert nedenfor, blokkeres av Gatekeeper-problematikk |

---

## Bakgrunn: Hvorfor kan Linux bygge for alle plattformer

Hotprevue har **ingen kompilering til maskinkode**. Innholdet i en release er:

| Komponent | Teknologi | Platform-spesifikt? |
|---|---|---|
| Backend | Python-kildekode | Nei |
| Frontend | Statisk HTML/CSS/JS (Vite-bygd) | Nei |
| Admin-konsoll | Python-kildekode | Nei |
| Startskript | Tekstfil (`.bat` / `.sh` / `.command`) | Kun filtype/syntaks |
| `uv`-binær | Forhåndskompilert av Astral | **Ja — én per plattform** |

Den eneste plattformspesifikke biten er `uv`-binæren. Denne kan lastes ned
for alle plattformer fra Astrals GitHub Releases uten å kjøre dem.
Alle andre deler er identiske på tvers av plattformer.

**Konklusjon:** Ubuntu-serveren kan bygge zip-pakker for alle plattformer i én operasjon.

---

## GitHub Releases — enkel forklaring

```
1. Du setter en tag i git og pusher den:
       git tag v0.2.0
       git push origin v0.2.0

2. GitHub oppdager taggen og starter en automatisk byggejobb (GitHub Actions).

3. Byggejobben kjører på Githubs servere (Ubuntu):
       – Bygger frontend
       – Laster ned uv-binær for Windows og Linux
       – Setter sammen én zip per plattform
       – Lager en ny "Release" på GitHub med zip-filene vedlagt

4. Under github.com/kjelkols/hotprevue/releases dukker det opp en ny post
   med nedlastingsknapper, én per plattform.

5. Brukeren laster ned én zip, pakker ut og dobbeltklikker startskriptet.
   Python og alle avhengigheter installeres automatisk av uv ved første start.
```

GitHub Actions er altså en CI/CD-tjeneste der du definerer hva som skal
skje i en YAML-fil (`.github/workflows/build-release.yml`). Det kjøres
på Githubs egne servere — du trenger ikke ha noe kjørende lokalt.

---

## Plattformmål

### Aktive plattformer

| Plattform | Zip-navn | `uv`-binær fra Astral |
|---|---|---|
| Windows x64 | `Hotprevue-x.y.z-windows.zip` | `uv-x86_64-pc-windows-msvc.zip` → `uv.exe` |
| Linux x64 | `Hotprevue-x.y.z-linux.zip` | `uv-x86_64-unknown-linux-gnu.tar.gz` → `uv` |

### Fremtidig plattform (utsatt)

| Plattform | Zip-navn | `uv`-binær fra Astral |
|---|---|---|
| macOS (universal) | `Hotprevue-x.y.z-mac.zip` | `uv-universal-apple-darwin.tar.gz` → `uv` |

**macOS universal binary** dekker både Apple Silicon (arm64) og Intel (x86_64) i én fil.
Én zip-fil vil holde for begge Mac-varianter.

---

## Zip-innhold per plattform

### Felles for alle plattformer

```
backend/          ← Python-kildekode (uten .venv, dist, __pycache__, tests, .env)
frontend/         ← Ferdigbygde statiske filer (fra frontend/dist/)
admin/            ← Admin-konsoll
```

### Windows (aktiv)

```
Hotprevue-x.y.z-windows.zip
├── backend/
├── frontend/
├── admin/
├── uv.exe
├── Hotprevue.bat          ← Dobbeltklikk for å starte
├── hotprevue-admin.bat
└── install.bat            ← Kjøres første gang
```

### Linux (aktiv)

```
Hotprevue-x.y.z-linux.zip
├── backend/
├── frontend/
├── admin/
├── uv                     ← Kjørbar (chmod +x settes i zip)
├── hotprevue.sh           ← Kjør i terminal for å starte
├── hotprevue-admin.sh
└── install.sh             ← Kjøres første gang
```

### macOS (utsatt)

```
Hotprevue-x.y.z-mac.zip
├── backend/
├── frontend/
├── admin/
├── uv                     ← Kjørbar (chmod +x settes i zip)
├── Hotprevue.command      ← Dobbeltklikk i Finder for å starte
├── hotprevue-admin.command
└── install.command        ← Kjøres første gang
```

`.command`-filer åpner Terminal automatisk ved dobbeltklikk i macOS Finder.

---

## Startskript-innhold

### Windows — `Hotprevue.bat` (eksisterer allerede)

```bat
@echo off
setlocal
set HOTPREVUE_LOCAL=true
set HOTPREVUE_OPEN_BROWSER=true
cd /d "%~dp0backend"
"%~dp0uv.exe" run --python 3.12 uvicorn main:app --host 127.0.0.1 --port 8000
endlocal
```

### Linux — `hotprevue.sh` (ny)

```bash
#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/backend"
HOTPREVUE_LOCAL=true HOTPREVUE_OPEN_BROWSER=true \
  "$DIR/uv" run --python 3.12 uvicorn main:app --host 127.0.0.1 --port 8000
```

`install.sh` tilsvarer `install.bat` og kaller `installer.py`.
`hotprevue-admin.sh` tilsvarer `hotprevue-admin.bat` og åpner admin-konsollen.

### macOS — `Hotprevue.command` (utsatt)

```bash
#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
# Fjern macOS-karantene fra uv-binæren (se Gatekeeper-note nedenfor)
xattr -d com.apple.quarantine "$DIR/uv" 2>/dev/null || true
cd "$DIR/backend"
HOTPREVUE_LOCAL=true HOTPREVUE_OPEN_BROWSER=true \
  "$DIR/uv" run --python 3.12 uvicorn main:app --host 127.0.0.1 --port 8000
```

---

## Kjente plattformproblemer

### macOS: Gatekeeper-karantene (blokkerer for nå)

macOS merker alle filer lastet ned fra internett med et karantene-flagg.
`uv`-binæren vil bli blokkert ved første kjøring med feilmeldingen
*"kan ikke åpnes fordi det er fra en ukjent utvikler"*.

Løsning A (valgt): `install.command` kjører `xattr -d com.apple.quarantine "$DIR/uv"`.
Krever at brukeren godkjenner dette i et dialogvindu første gang.

Løsning B (fremtidig): Kodesignering med Apple Developer-konto ($99/år) eliminerer
problemet helt, men er ikke nødvendig for en enkeltbrukerapp.

### macOS: Filrettigheter i zip

`.command`-filer og `uv`-binæren må være kjørbare (`chmod +x`).
`zip`-kommandoen på Linux bevarer UNIX-filrettigheter — dette må
settes eksplisitt med `zip -X` / `chmod` før pakking slik at
filene er kjørbare uten at brukeren må gjøre `chmod` manuelt.

### installer.py: Windows-spesifikke fonter

`installer.py` bruker `("Segoe UI", 13, "bold")` som er en Windows-eksklusiv font.
På macOS og Linux vil Tkinter falle tilbake til en systemfont. Layouten
fungerer, men ser ikke optimal ut. Bør løses når macOS/Linux-distribusjon
aktiveres — ikke blokkerende for bygging og testing av selve zippene.

---

## Byggeprosess

### GitHub Actions (automatisk, ved tag)

Én enkelt jobb på `ubuntu-latest` bygger alle aktive plattformer:

```
Steg 1  Hent versjon fra git-tag
Steg 2  Bygg frontend (npm ci && npm run build:web)
Steg 3  Last ned uv for Windows og Linux fra Astral
Steg 4  Sett sammen distribusjonskataloger for Windows og Linux
Steg 5  Pakk to zip-filer
Steg 6  Opprett GitHub Release med begge zip-filene vedlagt
```

Når macOS aktiveres: legg til nedlasting av macOS universal uv-binær
og en tredje zip i steg 3–5.

### Lokalt fra Ubuntu-serveren (manuelt)

Nye Makefile-mål:

```makefile
make build-zip-windows   # Lager Hotprevue-x.y.z-windows.zip
make build-zip-linux     # Lager Hotprevue-x.y.z-linux.zip
make build-zip-all       # Begge (utvides med mac når aktuelt)
```

`build-zip.ps1` utgår og slettes.

---

## Versjonshåndtering

Versjonsnummeret hentes fra git-tag (`v0.2.0` → `0.2.0`).
Det finnes ingen sentral versjonsfil i kildekoden — taggen er versjonen.

Ved lokal bygging (Makefile) leses versjonen fra siste git-tag:

```bash
VERSION=$(git describe --tags --abbrev=0 | sed 's/^v//')
```

---

## Vite-konfigurasjon for utvikling på Ubuntu-server

Dette gjelder ikke distribusjon, men er nødvendig for usecase 1
(live-testing fra Windows-nettleser mot Ubuntu-server):

**Problem:** `App.tsx` hardkoder `http://localhost:8000` i dev-modus,
som treffer Windows-maskinen, ikke Ubuntu-serveren.

**Løsning:**
- `App.tsx`: alltid bruk relativ base-URL (`''`)
- `vite.config.ts`: legg til `server.host: '0.0.0.0'` og proxy for alle
  API-ruter til `http://localhost:8000`

Disse endringene er uavhengige av distribusjonsspesifikasjonen og kan
implementeres separat.

---

## Filer som berøres av implementeringen

### Implementeres nå (Windows + Linux)

| Fil | Endring |
|---|---|
| `.github/workflows/build-release.yml` | Utvides til å bygge Windows + Linux zip |
| `Makefile` | Nye mål: `build-zip-windows`, `build-zip-linux`, `build-zip-all` |
| `build-zip.ps1` | **Slettes** |
| `hotprevue.sh` | **Ny fil** |
| `hotprevue-admin.sh` | **Ny fil** |
| `install.sh` | **Ny fil** |
| `docs/deployment.md` | Oppdateres (refererer til `build-zip.ps1` og WSL) |
| `CLAUDE.md` | Oppdateres (WSL-referanser, byggekommandoer) |

### Implementeres når macOS aktiveres

| Fil | Endring |
|---|---|
| `.github/workflows/build-release.yml` | Legg til macOS-zip |
| `Makefile` | Nytt mål: `build-zip-mac` |
| `Hotprevue.command` | **Ny fil** |
| `hotprevue-admin.command` | **Ny fil** |
| `install.command` | **Ny fil** |
| `backend/installer.py` | Fjern Windows-spesifikke fonter |

### Separat (Vite / utvikling)

| Fil | Endring |
|---|---|
| `frontend/src/App.tsx` | Fiks baseUrl (dev-modus) |
| `frontend/vite.config.ts` | Legg til host + proxy |
