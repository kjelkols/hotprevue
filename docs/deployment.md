# Deployment — Hotprevue

## Oversikt

En release består av to ting som skjer automatisk etter hverandre:

1. **Zip-filen bygges** og lastes opp til GitHub Releases
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

### 3. uv.exe lastes ned

`uv.exe` (Python-pakkehåndtereren for Windows) lastes ned fra astral-sh
sine offisielle releases. Det er uv som gjør at brukeren slipper å
installere Python selv.

### 4. Zip-pakken settes sammen

Innholdet i zip-filen:

```
Hotprevue-0.2.0.zip
├── backend/          ← Python-kildekode (uten .venv, tester osv.)
├── frontend/         ← Ferdigbygde statiske filer
├── admin/            ← Admin-konsoll
├── install.bat       ← Kjøres første gang for å sette opp appen
├── Hotprevue.bat     ← Legacy-startskript (erstattes av hotprevue.bat etter installasjon)
├── hotprevue-admin.bat
└── uv.exe
```

`hotprevue.bat` er **ikke** med i zip-en — den genereres av `install.bat`
på brukerens maskin med brukerens valgte konfigurasjon.

### 5. GitHub Release opprettes

En ny release publiseres automatisk under
`github.com/kjelkols/hotprevue/releases` med zip-filen som vedlegg.
GitHub genererer automatiske release notes basert på commits siden forrige tag.

### 6. Nettsiden oppdateres

Når releasen er publisert, starter workflow-en `pages.yml` automatisk.
Den setter inn riktig versjonsnummer og nedlastingslenke i `website/index.html`
og publiserer siden til GitHub Pages.

---

## Versjonsnummeret

Versjonsnummeret hentes fra taggen. Tag `v0.2.0` gir `Hotprevue-0.2.0.zip`.

Det finnes ikke ett sentralt sted i kildekoden der versjonen er definert —
taggen **er** versjonen. Husk å bruke samme nummer i `build-zip.ps1` hvis
du bygger manuelt fra Windows.

---

## Manuell bygging fra Windows (alternativt)

Hvis du ikke vil vente på GitHub Actions, kan du bygge zip-filen selv:

```bash
# Steg 1: Bygg frontend (WSL)
make build-web

# Steg 2: Pakk zip (Windows PowerShell)
powershell -ExecutionPolicy Bypass -File "\\wsl$\Ubuntu-22.04\home\kjell\hotprevue\build-zip.ps1"
```

Resultatet blir `hotprevue/Hotprevue-0.1.0.zip` (versjonsnummer satt i `build-zip.ps1`).

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
| `.github/workflows/build-release.yml` | Bygger zip og lager GitHub Release |
| `.github/workflows/pages.yml` | Publiserer nettsiden til GitHub Pages |
| `build-zip.ps1` | Manuell zip-bygging fra Windows |
| `website/index.html` | Nettside med nedlastingslenke (versjon injiseres av workflow) |
