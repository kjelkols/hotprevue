# Hotprevue – Agent Instructions

## Formål
Dette dokumentet gir retningslinjer og beslutningsgrunnlag for AI-agenten og utviklere i hotprevue-prosjektet. Det skal sikre konsistens, forenkling og rask utvikling.

## Overordnet arkitektur
- **Monorepo**: Én repo for backend (FastAPI), frontend (webapp), felles schemas og dokumentasjon.
- **Database**: PostgreSQL, kjøres via Docker Compose.
- **Bildebehandling**: All prosessering skjer i backend.
- **Frontend**: Uavhengig webapp, kommuniserer med backend via HTTP API.
- **Ingen multi-user**: Hver instans har én database og én bruker.
- **Tailscale**: Backend og frontend kan nås privat via Tailscale-nettverk.

## Teknologivalg
- **Backend**: FastAPI, SQLAlchemy (sync, psycopg2-binary), Alembic for migrering. Aldri async — se backend-architecture.md.
- **Frontend**: React 18 + TypeScript + Tailwind CSS + Vite. React Query for server-state, Zustand for klient-state, Radix UI for komplekse komponenter.
- **CI/CD**: Github Actions, Docker Compose for lokal utvikling.

## Viktige beslutninger
- **Base64 for bilder**: All bildebinærdata i API-respons skal være base64-kodet.
- **API skal lytte på 0.0.0.0**: For å være tilgjengelig via Tailscale og Docker.
- **Start med minimal funksjonalitet**: Bildeopplasting, metadata-lagring, enkel galleri-visning.
- **Ingen migrering nødvendig**: Hver instans starter med tom database.
- **Felles utviklingsmiljø**: Bruk Docker Compose/devcontainer for enkel oppstart.

## TODO/roadmap (utkast)
1. Sett opp mappestruktur for backend, frontend, schemas, docs, devops.
2. Lag docker-compose.yml med PostgreSQL og backend.
3. Implementer første FastAPI-endepunkt for bildeopplasting og metadata.
4. Sett opp frontend med enkel visning og opplasting.
5. Dokumentér API og dataflyt.
6. Sett opp CI/CD og teststruktur.

## Retningslinjer for agenten
- Følg alltid base64-kontrakt for bilder i API.
- Backend skal være tilgjengelig på 0.0.0.0.
- Bruk miljøvariabler for database-URL.
- Prioriter enkelhet og tydelighet i kode og struktur.
- Oppdater denne filen ved større arkitektur- eller teknologivalg.

---

Dette dokumentet skal ligge i /docs/agent-instructions.md og oppdateres fortløpende ved endringer i prosjektets retning eller beslutninger.


# Roadmap og funksjonsliste for Hotprevue (basert på Imalink)

## Hovedfunksjoner (MVP)
- **Bildeimport og -lagring**
	- Opplasting av bilder (JPEG, PNG, RAW)
	- Automatisk EXIF-uttrekk og lagring av metadata
	- Generering av hotpreview (150x150, base64 i DB) og coldpreview (800-1200px, lagres på disk)
	- Hothash (SHA256 av hotpreview) som unik bilde-ID
	- Perceptual hash for duplikatdeteksjon og similarity search
    - Hver ny import genererer en import-session som knyttes til bildene. 

- **Stack-funksjon for grupperte bilder**
	- Brukeren kan gruppere flere bilder av samme motiv i en “stack” for enklere visning.
	- Stack implementeres enkelt ved at hvert bilde kan ha en `stack_id` (felles for alle bilder i samme stack).
	- Stacks kan opprettes, endres og oppløses manuelt, og systemet kan foreslå stacks automatisk (f.eks. basert på tidsstempel eller motiv).
	- I galleriet vises en stack som ett bilde (cover), med mulighet for å ekspandere for å se alle bilder i stacken.
	- Stack har ingen egne metadata – kun en visningshjelp, alle metadata ligger på enkeltbildene.
	- Funksjonen skal være intuitiv og transparent for brukeren.
    - Ett bilde i hver stack markeres som coverbilde ved å sette feltet `is_stack_cover` til true.

- **Bildevisning og galleri**
	- Grid/timeline-visning av bilder
	- Lazy loading og paginering
	- Detaljvisning med metadata

- **Metadataredigering**
	- Rediger rating (1-5), lokasjon
	- Støtte for batch-redigering

- **Søk og filtrering**
	- Tekstsøk på metadata
	- Filtrering på rating, dato, event, kategori

- **Collections**
	- En collection er en ordnet gruppe med bilder, hvor rekkefølgen er viktig.
    - Hvert bilde i en collection kan ha beskrivende tekst (caption).
    - Tekstkort med valgfri layout kan legges inn i tillegg til bildene.
	- Brukes til lysbildeserier, animasjoner, kollasjer, panorama, portefølje, leveranser og kuratering.
	- Brukeren kan bestemme og endre rekkefølgen på bildene.
	- Kan ha egne metadata (navn, beskrivelse, coverbilde, type).
	- Mange-til-mange: Et bilde kan inngå i flere collections.
	- Kan eksporteres eller brukes som input til spesialfunksjoner.

- **Events**
	- En event er en uordnet gruppe med bilder, typisk knyttet til en hendelse, tid eller sted.
	- Brukes til å organisere bilder fra samme hendelse, batch-organisering og filtrering.
	- Kan ha hierarki (parent-child, f.eks. "Bryllup > Fest > Dans").
	- Kan ha metadata (navn, beskrivelse, dato, sted).
	- Ett bilde kan kun tilhøre én event (one-to-many).
	- Ingen rekkefølge – alle bilder er likestilte.

- **Stories (PhotoText)**
	- Block-basert editor for artikler med bilder og tekst
	- Knytt bilder til stories

- **Bildekorreksjoner**
	- Ikke-destruktiv korreksjon av tid, sted og visning (rotasjon, crop, eksponering)
	- Korreksjoner lagres separat fra originaldata

- **Registrering/eksport**
	- Registrering fra lokale mapper
	- Eksport av bilder og metadata

- **Companion files og fleksibel filstruktur**
	- Hvert bilde kan ha flere tilknyttede filer (“companion files”), f.eks. RAW, JPEG, XMP, sidecar, tekst eller andre metadatafiler.
	- Datamodellen skal støtte en liste over companion files per bilde, med type (RAW, JPEG, XMP, etc.), filsti og evt. ekstra metadata.
	- Registrerings- og visningslogikk skal håndtere og vise alle relevante companion files.
	- Dette gir fleksibilitet for fremtidige filtyper og arbeidsflyter, og gjør det enkelt å utvide systemet uten endring i grunnstrukturen.

## Arkitektur og tekniske valg
- **Backend:** FastAPI, async databaseklient (SQLAlchemy async/Tortoise/Gino), Alembic for migrering
- **Database:** PostgreSQL (kjøres lokalt)
- **Frontend:** Moderne rammeverk (React/Vue/Svelte)
- **Bildebehandling:** Egen tjeneste eller integrert i backend (basert på imalink-core)
- **Lagring:** Metadata og hotpreview i DB, coldpreview på disk (hash-basert struktur)
- **Autentisering:** Ingen (single-user)
- **Miljø:** Docker Compose for enkel oppstart

## Fremtidig utvidelse (ikke MVP)
- **Ekstern publisering:** Mulighet for å publisere bilder til ekstern server slik at brukere kan se hverandres bilder (arkitektur bør forberedes for dette, men ikke implementeres nå)
- **Web viewer:** Lesetilgang for eksterne brukere

# Analyse og strategi: Database, coldpreview og originalfiler i Hotprevue

## 1. Komponentroller
- **Database:**
  - Inneholder all metadata om bilder (EXIF, brukerdata, hothash, filstier til originaler, base64 hotpreview).
- **Coldpreview-filer:**
  - Genereres ved registrering, lagres i dedikert katalogtre (hash-basert).
  - Brukes til visning i frontend (rask, mellomstor forhåndsvisning).
  - Kan alltid regenereres fra originalfilene.
- **Originalfiler:**
  - Brukeren har full kontroll over hvordan originalbildene blir organisert
  - Ligger utenfor systemet (NAS, ekstern disk, etc.).
  - Kun filsti og metadata lagres i databasen.

## 2. Bruksscenario
- **Registrering på bærbar:**
  - Registrer bilder, generer hotpreview/coldpreview, lagre metadata og coldpreview-filer lokalt.
- **Synkronisering:**
  - Synkroniser database og coldpreview-filer til hjemmelab-server når du er tilbake.
- **Visning:**
  - Frontend bruker kun database og coldpreview-filer for visning.
  - Originalfiler hentes kun ved behov, basert på lagret filsti.

## 3. Grensesnitt og avhengigheter
- Database og coldpreview-filer må alltid være i synk (samme hothash, samme katalogstruktur).
- Originalfiler er ikke en del av systemet, men systemet må kunne validere at filstien fortsatt peker til en eksisterende fil.
- Coldpreview-filer kan slettes og regenereres fra originalen hvis nødvendig.

## Anbefalt strategi

1. **Hold database og coldpreview-filer sammen**
   - Ved synkronisering mellom maskiner, må begge overføres (f.eks. rsync av database og coldpreview-mappe).
   - Bruk en fast katalogstruktur for coldpreview (f.eks. `/data/coldpreviews/ab/cd/abcd1234...jpg`).

2. **Originalfiler er “eksterne”**
   - Lagre kun filsti og metadata i databasen.
   - Implementer periodisk sjekk for å validere at filstier fortsatt er gyldige.
   - Ved visning/eksport, hent originalfil fra lagret sti.

3. **Registrering og synkronisering**
   - Registrer alltid via frontend på bærbar/server.
   - Etter registrering, synkroniser database og coldpreview til hjemmelab-server (f.eks. via rsync, Nextcloud, Syncthing).
   - Unngå å endre data på to steder samtidig for å unngå konflikter.

4. **Regenerering av coldpreview**
   - Hvis coldpreview mangler, forsøk å regenerere fra originalfil (hvis tilgjengelig).
   - Hvis originalfil ikke finnes, marker bildet som “utilgjengelig”.

5. **Backup**
   - Ta jevnlig backup av database og coldpreview-mappe.
   - Originalfiler må brukeren selv ta ansvar for.

## Oppsummering
- Database og coldpreview-filer er “systemet” og må alltid synkroniseres sammen.
- Originalfiler er eksterne og kun referert til via filsti.
- Unngå toveis redigering – velg én “master” (f.eks. hjemmelab-server) og synkroniser alltid endringer dit.
- Regenerer coldpreview fra original ved behov.
- Implementer validering av filstier til originaler.

# Brukerkontroll og støtteverktøy for organisering

Hotprevue skal ikke flytte, endre eller ta eierskap over originalbildene. Brukeren bestemmer selv hvor og hvordan originalene lagres, prosesseres og organiseres. Systemet fungerer som et indexerings- og visningssystem, og gir kun støtte og oversikt.

## Støtteverktøy i frontend
- Filstikontroll: Vis status for originalfil (eksisterer/ikke, tilgjengelig/ikke), og gi varsler hvis filen er flyttet eller slettet.
- Søk og filtrering: Søk på filstier, mapper, filnavn, og vis hvor originalene er lagret.
- Batch-verktøy: Mulighet for å batch-oppdatere filstier hvis bilder flyttes.
- Organiseringshjelp: Visualiser hvor bildene er lagret, f.eks. trestruktur, kart, eller liste.
- Registrerings-assistent: Veilede brukeren ved registrering, f.eks. "Velg mappe for originaler", "Registrer fra valgt kilde".
- Ekstern åpning: Mulighet for å åpne originalfilen i eksternt program (f.eks. Lightroom, Photoshop) direkte fra Hotprevue.
- Status og validering: Periodisk sjekk av filstier, og vis status for tilgjengelighet.

Brukeren ser alltid hvor originalen er lagret, og kan selv endre eller oppdatere filstien. Hotprevue gir kun støtte og oversikt – ingen automatisk flytting, sletting eller endring. Alle organiseringstiltak er non-intrusive og gir brukeren full kontroll.
