# Deployment — Hotprevue

## Oversikt

En release består av to ting som skjer automatisk etter hverandre:

1. **Zip-filene bygges** og lastes opp til GitHub Releases (Windows + Linux)
2. **Nettsiden oppdateres** med riktig versjonsnummer og nedlastingslenke

Alt dette skjer i GitHub Actions — du trenger ikke gjøre noe annet enn å
sette en Git-tag og pushe den.

---

## Slik releaser du

```bash
git tag v0.2.0
git push origin v0.2.0
```

Det er alt. Resten skjer automatisk på GitHub.

Følg med under: `github.com/kjelkols/hotprevue → Actions`

---

## Hva skjer steg for steg

### 1. Du pusher en tag (`v*`)

GitHub ser taggen og starter workflow-en `build-release.yml`.

### 2. Frontend bygges (i GitHub Actions)

GitHub Actions kjører `npm ci && npm run build:web` i `frontend/`-mappen.
Resultatet er statiske filer i `frontend/dist/`.

### 3. uv-binærer lastes ned

`uv` (Python-pakkehåndtereren) lastes ned fra astral-sh sine offisielle releases
for hver plattform. Det er uv som gjør at brukeren slipper å installere Python selv.

- Windows: `uv.exe` (x86_64)
- Linux: `uv` (x86_64)

### 4. Zip-pakkene settes sammen

**Windows** `Hotprevue-0.2.0-windows.zip`:
```
├── backend/          ← Python-kildekode (uten .venv, tester osv.)
├── frontend/         ← Ferdigbygde statiske filer
├── admin/            ← Admin-konsoll
├── install.bat       ← Kjøres første gang for å sette opp appen
├── Hotprevue.bat     ← Legacy-startskript (erstattes av hotprevue.bat etter installasjon)
├── hotprevue-admin.bat
└── uv.exe
```

**Linux** `Hotprevue-0.2.0-linux.zip`:
```
├── backend/
├── frontend/
├── admin/
├── install.sh        ← Kjøres første gang
├── hotprevue.sh      ← Startskript
├── hotprevue-admin.sh
└── uv                ← Kjørbar (chmod +x satt i zip)
```

`hotprevue.bat` (Windows) er **ikke** med i zip-en — den genereres av `install.bat`
på brukerens maskin med brukerens valgte konfigurasjon.

### 5. GitHub Release opprettes

En ny release publiseres automatisk under
`github.com/kjelkols/hotprevue/releases` med begge zip-filene som vedlegg.
GitHub genererer automatiske release notes basert på commits siden forrige tag.

### 6. Nettsiden oppdateres

Når releasen er publisert, starter workflow-en `pages.yml` automatisk.
Den setter inn riktig versjonsnummer og nedlastingslenke i `website/index.html`
og publiserer siden til GitHub Pages.

---

## Versjonsnummeret

Versjonsnummeret hentes fra taggen. Tag `v0.2.0` gir `Hotprevue-0.2.0-windows.zip`
og `Hotprevue-0.2.0-linux.zip`.

Det finnes ikke ett sentralt sted i kildekoden der versjonen er definert —
taggen **er** versjonen.

---

## Manuell bygging fra Ubuntu-server (alternativt)

Hvis du ikke vil vente på GitHub Actions, kan du bygge zip-filene selv:

```bash
make build-zip-all       # Bygger begge plattformer
make build-zip-windows   # Kun Windows
make build-zip-linux     # Kun Linux
```

Versjonsnummer hentes automatisk fra siste git-tag.

---

## Manuell kjøring av nettsiden

Hvis du vil oppdatere nettsiden uten å lage en ny release:

1. Gå til `github.com/kjelkols/hotprevue → Actions → Deploy Pages`
2. Klikk **Run workflow**
3. Skriv inn taggen du vil peke til (f.eks. `v0.2.0`)

---

## Filer involvert

| Fil | Formål |
|---|---|
| `.github/workflows/build-release.yml` | Bygger zip-pakker og lager GitHub Release |
| `.github/workflows/pages.yml` | Publiserer nettsiden til GitHub Pages |
| `Makefile` | Lokale build-mål (`build-zip-windows`, `build-zip-linux`) |
| `hotprevue.sh` | Linux-startskript (pakkes i linux-zip) |
| `hotprevue-admin.sh` | Linux admin-startskript |
| `install.sh` | Linux-installasjonsscript |
| `website/index.html` | Nettside med nedlastingslenke (versjon injiseres av workflow) |
