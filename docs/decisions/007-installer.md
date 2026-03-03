# 007 — Tkinter-installer og generert oppstartsfil

## Status

Implementert

## Kontekst

Hotprevue distribueres som en portabel zip-fil og installeres ikke i Windows-registeret.
Brukeren pakker ut zip-en ett vilkårlig sted — inkludert på ekstern disk — og kjører
programmet derfra.

Appen er avhengig av å vite hvor datakatalogen (PostgreSQL-data, coldpreviews) skal ligge.
Denne avgjørelsen er brukerspesifikk og kan ikke hardkodes i distribusjonen.

## Beslutning

Zip-pakken inneholder en **`install.bat`** som kjører en Tkinter-veiviser
(`backend/installer.py`). Veiviseren stiller brukeren ett enkelt valg og genererer
en ferdig konfigurert **`hotprevue.bat`** som brukes ved alle fremtidige oppstarter.

### Installasjonsflyten

```
install.bat
  └─ uv run python installer.py --root <rotkatalog>
       │
       ├─ Steg 1: Velg datakatalog
       │     ├─ Portabel     — <rotkatalog>\data\
       │     ├─ Brukerprofil — %APPDATA%\Hotprevue
       │     └─ Egendefinert — bla-dialog + fritekst
       │
       ├─ Finnes pgdata allerede?
       │     ├─ JA  → Steg 1b: Sikkerhetskopi
       │     │           ├─ "Ta sikkerhetskopi…" → velg sted → zip lagres
       │     │           └─ "Fortsett uten backup →"
       │     │               └─ Generer hotprevue.bat → ferdig-skjerm
       │     │
       │     └─ NEI → Steg 2: Maskinnavn + første fotograf
       │                 └─ Opprett DB, kjør migrasjoner,
       │                    registrer maskin og fotograf
       │                    → Generer hotprevue.bat → ferdig-skjerm
       │
       └─ Ferdig-skjerm: vis sti til hotprevue.bat
             └─ [Start Hotprevue nå] eller [Avslutt]
```

### Den genererte hotprevue.bat

Innholdet varierer etter valgt datakatalogmodus:

| Modus | DATA_DIR-linje i bat-filen |
|---|---|
| Portabel | `set DATA_DIR=%~dp0data` |
| Brukerprofil | `set DATA_DIR=%APPDATA%\Hotprevue` |
| Egendefinert | `set DATA_DIR=C:\eksakt\absolutt\sti` |

`%~dp0` i den genererte filen er relativ til `hotprevue.bat` selv, ikke til
rotkatalogen på installasjonstidspunktet. Portabel modus er derfor robust mot
endring av diskbokstav.

### Eksisterende database og sikkerhetskopi

Hvis `<datakatalog>/pgdata` allerede finnes og ikke er tom, viser veiviseren
et eget steg (1b) før den fortsetter. Brukeren informeres om å ta backup og
kan opprette en zip-fil av databasen direkte i veiviseren.

Etter backup (eller valg om å hoppe over) genereres `hotprevue.bat` og
veiviseren avsluttes. Steg 2 (maskinnavn + fotograf) vises ikke — det er
allerede registrert i databasen fra første gangs oppsett.

## Filstruktur

```
hotprevue/
├── install.bat          ← Startpunkt for installasjon
├── hotprevue.bat        ← Generert av installer, brukes fremover
├── uv.exe
├── backend/
│   ├── installer.py     ← Tkinter-veiviser
│   └── …
└── frontend/
```

## Scenarioanalyse: diskplassering

### Scenario A — Alt på ekstern disk (portabel modus)

Programmet og dataene ligger i samme katalog på ekstern disk.
`hotprevue.bat` bruker `%~dp0data` som DATA_DIR.
Diskbokstaven kan endre seg mellom maskiner — det spiller ingen rolle fordi
`%~dp0` alltid peker relativt til bat-filen.

**Resultat:** Fullt portabel. Fungerer på alle maskiner.

### Scenario B — Program på maskin, data på maskin (brukerprofil)

Standardscenario for fast installasjon.
`hotprevue.bat` bruker `%APPDATA%\Hotprevue`.
`%APPDATA%` ekspanderes av Windows ved oppstart og er alltid korrekt
for den innloggede brukeren.

**Resultat:** Robust. Anbefalt for stasjonære brukere.

### Scenario C — Program på ekstern disk, data på maskin

Veiviseren advarer om at program og data er på forskjellige disker.
`hotprevue.bat` bruker `%APPDATA%\Hotprevue`.
Brukeren kan ta med programdisken til en annen PC, men dataene forblir
på den opprinnelige maskinen.

**Resultat:** Fungerer, men ikke offisielt støttet i denne versjonen.
Anbefalt å bruke portabel modus i stedet.

### Scenario D — Data på ekstern disk, program på maskin

Egendefinert sti som peker til ekstern disk.
Veiviseren advarer om ulike disker.
DATA_DIR skrives som absolutt sti i `hotprevue.bat`, inkludert diskbokstav.
Hvis diskbokstaven endrer seg, vil ikke appen finne databasen.

**Resultat:** Ikke offisielt støttet. Brukeren må selv håndtere eventuelle
diskbokstav-konflikter.

## Sikkerhetskopi

### Hva backupen inneholder

Backupen er en zip-fil med to mapper fra datakatalogen:

| Mappe | Innhold |
|---|---|
| `pgdata/` | Hele PostgreSQL-dataklyngen (database, tabeller, indekser) |
| `coldpreviews/` | Forhåndsvisningsfiler på disk (kan regenereres, men tar tid) |

### Filformat og navngiving

Zip-filen foreslås navngitt med tidsstempel:
`hotprevue-backup-20260303-141500.zip`

Brukeren velger selv hvor filen lagres via en standard lagre-dialog.

### Hvorfor filbasert backup og ikke SQL-dump

Admin-konsollen bruker `pg_dump` via den kjørende backenden (SQL-dump).
Det krever at serveren er oppe.

I installereren er pgserver ikke startet ennå. En filbasert kopi av
`pgdata/` er trygg å gjøre mens PostgreSQL er nede, og er komplett —
den inneholder alt `pg_dump` ville gitt, pluss konfigurasjon og
transaksjonskøen.

### Gjenoppretting

Gjenoppretting er manuell: erstatt `pgdata/` og `coldpreviews/` i
datakatalogen med innholdet fra zip-filen. Appen trenger ikke å kjøre
under gjenoppretting.

## Tekniske detaljer

### Databaseoppsett ved ny installasjon

Installer-scriptet setter `DATA_DIR` og `HOTPREVUE_LOCAL=true` i `os.environ`
og kaller deretter den eksisterende `core.local_setup.setup_local_environment()`.
Dette starter pgserver og oppretter databasen via den vanlige kodeveien.
Alembic-migrasjoner kjøres deretter direkte (`alembic upgrade head`).

### Opprydding av pgserver før oppstart

Installer.py stopper pgserver eksplisitt (`builtins._pg_server.cleanup()`)
før `hotprevue.bat` lanseres, for å unngå at to pgserver-instanser
kjører mot samme pgdata-katalog samtidig.

### install.bat vs hotprevue.bat

| Fil | Formål | Brukes |
|---|---|---|
| `install.bat` | Kjører Tkinter-veiviseren | Én gang (eller ved rekonfigurering) |
| `hotprevue.bat` | Starter appen direkte | Ved hver normal oppstart |

`install.bat` er inkludert i zip-distribusjonen.
`hotprevue.bat` er *ikke* forhåndslaget — den genereres av veiviseren.
