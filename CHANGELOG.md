# Endringslogg

Dette dokumentet sporer alle brukersynlige endringer i Hotprevue.
Brukes som grunnlag for release-dokumentasjon.

---

## [Ikke utgitt] — Preorganisering

### Ny funksjonalitet

#### Preorganisering-fane
Ny fane i navigasjonen for lokal filbehandling **før** registrering.
Alt skjer på klientmaskinen via den lokale agenten — ingenting skrives til
backend-databasen på dette stadiet.

**Venstrekolonne (FolderPanel)**
- Katalognavigasjon med undermapper
- Deteksjon av tilkoblede minnekort (removable volumes)
- Festede mapper (📌) som lagres permanent i `localStorage`
- Hurtignavigasjon til festet mappe med ett klikk

**Bildegrid (PhotoFolderGrid)**
- Thumbnails genereres automatisk av agenten i bakgrunnen (prescan)
- Sortering på dato tatt (EXIF DateTimeOriginal)
- Datogruppering med seksjonsoverskrifter (kan slås av/på)
- EXIF-tooltip ved hover: dato, kamera/telefon, GPS, filtype, companions

**Utvalg — Windows Explorer-mønster**
- Enkelt klikk: velg kun dette bildet
- Ctrl+klikk: legg til / fjern fra utvalg
- Shift+klikk: rekkeviddevalg fra siste ankerpunkt
- Klikk på bakgrunn: nullstill utvalg
- Velg alle / avbryt valg via verktøylinje

**Datoutvalg**
- Klikk på datooverskrift: velg / fjern alle bilder på denne datoen (togler)
- Ctrl+klikk på dato: legg til / fjern hele datoen
- Shift+klikk på dato: velg alle datoer mellom anker og klikket dato
- Avkryssingsboks på overskriften viser hel / delvis / ingen valg

**Velg tidsrom**
- Dato/tid fra–til-velger i verktøylinjen
- Markerer automatisk alle bilder innenfor tidsrommet

**Flytt til mappe**
- Velg bilder, klikk "Flytt til…" → FileBrowser åpnes
- FileBrowser har nå "Ny mappe her"-funksjon: lag undermappe og flytt i én operasjon
- Companions (RAW+JPEG+XMP) flyttes alltid samlet

**Flytt til ny mappe fra dato**
- "→ mappe"-knapp vises ved hover på datooverskriften
- Inline-panel foreslår mappenavn basert på første dato i gruppen (`YYYY_MM_DD`)
- Brukeren kan redigere navnet fritt — ingen format-tvang
- Forhåndsvisning av full destinasjonssti og antall filer
- Oppretter mappe og flytter alle filer (inkl. companions) i én operasjon

**Kortimport (minnekort)**
- Detekterte minnekort vises i venstrekolonnen
- Klikk åpner kopieringspanel (eksplisitt, ikke automatisk)
- SHA256-verifisering av hver fil etter kopiering
- Valgfri sletting av kildefiler fra kortet etter verifisert kopiering
- Enhetsnavn kan angis (f.eks. "Sony A7IV kort 1")

**Forhåndsvisning (lightbox)**
- Dobbeltklikk på thumbnail åpner fullskjerm-forhåndsvisning
- Bildene serveres direkte fra originalfilen av agenten — ingen mellomlagring
- Forrige/neste-piler og piltaster (←→)
- Zoom med scrollhjul, sentrert på musepeker (1×–12×)
- Pan (dra) ved zoom
- Dobbeltklikk eller Escape resetter zoom
- Zoom-prosent vises i telleren
- Sidefelt med EXIF-data: dato, kamera, linse, ISO, lukker, blende, brennvidde,
  bildedimensjoner, filstørrelse, GPS-koordinater
- Slett bilde med bekreftelsesdialog — sletter master + alle companions

**URL-persistering**
- Gjeldende katalog synkes med URL-parameteren `?dir=`
- Nettleserrefresh beholder valgt katalog

#### Prescan-cache (agent-side)
- Lokal SQLite-database (`prescan.db`) lagrer hotpreview og EXIF per fil
- Cache-nøkkel: `(filsti, mtime, size)` — oppdateres automatisk ved endring
- Bakgrunnsskanning med `ThreadPoolExecutor(max_workers=2)`
- Filer der preview-generering feiler caches ikke (prøves på nytt ved neste skanning)
- Stier oppdateres i cache ved flytt via verktøyet

#### Nye agent-endepunkter
- `POST /prescan/start` — start bakgrunnsskanning av katalog
- `GET /prescan/status/{id}` — poll fremdrift
- `GET /prescan/files?dir=` — hent cached metadata for katalog
- `POST /files/move` — flytt filgruppe (master + companions) til ny katalog
- `DELETE /files/group` — slett filgruppe inkl. companions, fjern fra cache
- `POST /files/mkdir` — opprett katalog
- `GET /process/exif` — hent EXIF-metadata uten å generere preview
- `GET /process/preview` — server skalert JPEG direkte fra originalfil (ingen lagring)

### Endringer i eksisterende funksjonalitet

#### Registreringsflyt (StepSetup)
- Kortkopiering (CopySection) er fjernet fra registreringsflyten
- Erstattet med en ikke-blokkerende informasjonsmelding ved minnekort-sti:
  "Kopier bildene til disk i Preorganisering-fanen før du registrerer"
- Brukeren kan fortsette uten å kopiere (ingen blokkering)

#### FileBrowser
- Ny valgfri funksjon "Ny mappe her": lag undermappe og velg den i én operasjon
- Aktiveres per brukssted med prop `allowNewFolder`

---

## Eldre versjoner

Se git-historikk for endringer før Preorganisering-fanen.
