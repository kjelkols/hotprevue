# 013 — Migrasjon fra lokal til sentral database

## Status

Godkjent

## Kontekst

En-bruker-modus (pgserver, alt på én maskin) og fler-bruker-modus (sentral
PostgreSQL) er de to installasjonsmodi i Hotprevue. En naturlig livssyklus er
at en bruker starter i en-bruker-modus og senere ønsker å flytte til sentral
server — enten fordi partneren begynner å fotografere, eller for å samle bilder
fra flere maskiner.

Migrasjon skjer i to mulige situasjoner:

- **Maskin 1** migrerer til en sentral server som er tom eller ikke har
  overlappende data.
- **Maskin 2+** migrerer til en sentral server som allerede har data fra
  maskin 1 — bilder, events og minst én fotograf.

## Beslutning

### Migrasjon er en "move", ikke en "copy"

Etter fullført migrasjon deaktiveres den lokale databasen. Maskinen arbeider
heretter utelukkende mot sentral server. Lokal pgserver startes ikke lenger.
Lokale data-filer beholdes på disk som passiv backup, men brukes ikke.

Det er ikke mulig å "rulle tilbake" til lokal modus uten manuell inngrep.
Dette er et bevisst valg: to aktive databaser på samme maskin er en oppskrift
på inkonsistens.

### Migrasjonsmekanismen gjenbruker eksisterende API

Migrasjon er ikke en separat overføringsmekanisme. Det er en tosstegs-operasjon
som gjenbruker det som allerede finnes:

```
Steg 1: Bilderegistrering
  Klienten repointer mot sentral server-URL.
  Klienten re-registrerer alle lokale bilder via eksisterende
  POST /input-sessions/{id}/groups (med coldpreview_b64).
  check-hothashes hopper over bilder som allerede finnes på sentral server.

Steg 2: Push av organisering
  Klienten pusher events, ratings og event-tilordninger via push-APIet
  (se docs/spec/push.md) med navn-som-identitet for events.
```

Ingen ny filoverføringsmekanisme. Coldpreviews sendes som base64 i
registreringssteget, akkurat som ved vanlig registrering.

### Fotografidentitet løses eksplisitt ved migrasjon

`photos.photographer_id` er NOT NULL og er en FK til `photographers.id` (UUID).
Lokal UUID og sentral UUID er aldri koordinerte — de er uavhengig generert.

Ved migrasjonsstart må brukeren eksplisitt identifisere seg mot sentral server:

```
Alternativ A: "Jeg er en ny person"
  → Opprett photographer på sentral server → få sentral UUID
  → Bruk sentral UUID for alle bilder i migrasjonen

Alternativ B: "Jeg er allerede registrert" (velg fra liste)
  → Hent eksisterende photographer UUID fra sentral server
  → Bruk denne UUID-en for alle bilder i migrasjonen
```

Remapping av photographer_id skjer i migrasjonslogikken — ikke i databasen.
Lokal database røres ikke.

### Maskin 2 bruker samme flyt som maskin 1

Det finnes ikke to separate migrasjonsflyter. Maskin 2s migrasjon er identisk
med maskin 1s, men resulterer i additiv sammenslåing:

- **Bilder:** hothash-dedup sikrer at duplikater (samme motiv fotografert av
  begge) ikke dobbeltregistreres.
- **Events:** navn-som-identitet merger events med samme navn. "Familietur 2026"
  fra maskin 1 og maskin 2 slås sammen til ett event med bilder fra begge.
- **Ratings:** max-rating (se push-spec).
- **Photographer:** maskin 2s bruker velger/oppretter sin fotograf eksplisitt.

### Maskinregistrering skjer før bilderegistrering

Maskinen må eksistere på sentral server før bilder kan registreres (ADR-011:
`photos.registered_by_machine_id`). Migrasjonsflytens første steg er derfor:

```
POST /machines  →  sentral server oppretter maskin, returnerer machine_id
```

Denne `machine_id` brukes i alle påfølgende registreringskall.

## Brukeropplevelse

Wizard med fire steg — brukeren gjør ingen tekniske valg:

```
1. "Vil du flytte til sentral server?" [Ja]
2. "Serverens adresse:" [URL-felt]
3. "Hvem er du?" [Ny: navn] eller [Velg: Far / Barn / ...]
4. "Overfører 400 bilder..." [fremdriftslinje]
   "Ferdig. Lokale data er deaktivert. Du er koblet til <URL>."
```

## Dataflyt — fullstendig oversikt

```
Lokal maskin                          Sentral server
─────────────────────────────────     ──────────────────────────────────
1. POST /machines                 →   Opprett maskin + returner machine_id
   { machine_name, photographer }      og photographer_id

2. POST /input-sessions           →   Opprett input-sesjon

3. POST /input-sessions/{id}/     →   check-hothashes: hvilke finnes allerede?
   check-hothashes

4. For ukjente hothashes:
   POST /input-sessions/{id}/     →   Lagre metadata + skriv coldpreview til disk
   groups (med coldpreview_b64)

5. POST /push                     →   Opprett/merger events
   { events, photos[rating,            Sett ratings (max)
     event-tilordning] }               Tilordne bilder til events

6. Marker lokal DB som migrert        —
   Stopp pgserver
   Skriv ny konfigurasjon:
   DATABASE_URL=<sentral>
```

## Coldpreviews

Coldpreviews genereres av klienten og sendes som base64 i steg 4. De lagres
på sentral servers disk i hash-basert struktur (ADR-008). Lokale coldpreviews
beholdes passivt på disk — de brukes ikke etter migrasjonen.

Hvis maskin 2 sender et bilde som maskin 1 allerede har registrert (samme
hothash), hopper `check-hothashes` over det — coldpreview er allerede på
server-disk.

## Deaktivering av lokal database

Etter fullført migrasjon:

- Konfigurasjonsfil oppdateres: `HOTPREVUE_SERVER=http://<sentral>`, `DATABASE_URL=<sentral>`
- pgserver startes ikke ved neste oppstart
- Lokal data-katalog (`~/.local/share/Hotprevue` / `%APPDATA%\Hotprevue`)
  beholdes urørt som passiv backup
- UI viser tilkoblingsstatus mot sentral server ved oppstart

## Begrunnelse

**Hvorfor "move" og ikke "copy"?**
To aktive databaser på samme maskin krever sync for å holde seg konsistente.
Sync er unødvendig kompleksitet (analysert og avvist). En klar move-semantikk
gir brukeren én sannhetskilde.

**Hvorfor gjenbruke eksisterende API?**
Registrerings-APIet sender allerede hothash, coldpreview og metadata.
En separat "databaseeksport/import"-mekanisme ville duplisert dette og
introdusert et nytt format å vedlikeholde.

**Hvorfor eksplisitt fotografidentifikasjon?**
Automatisk matching (f.eks. på navn) er upålitelig og kan feilattribuere bilder.
Én eksplisitt brukerhandling er enklere å forstå og feilsøke.

**Hvorfor ingen separat maskin-2-flyt?**
Additiv sammenslåing via hothash-dedup og navn-som-identitet for events er
tilstrekkelig. En special-case for maskin 2 ville øke kompleksiteten uten å
løse noe hothash og navn ikke allerede håndterer.

## Konsekvenser

- Migrasjonswizard må implementeres i frontend og klient
- `POST /machines`-endepunkt må implementeres (maskinregistrering)
- Push-APIet (`POST /push`) må implementeres (se `docs/spec/push.md`)
- Konfigurasjonsskriving etter migrasjon håndteres av klient (ikke backend)
- Lokal konfigurasjon må støtte `migrated_at`-tidsstempel for sporbarhet
- `docs/spec/push.md` — push-spesifikasjonen er det tekniske grunnlaget for
  steg 5 i migrasjonen

## Åpne spørsmål

1. **Avbrutt migrasjon:** Hvis migrasjonen avbrytes etter steg 4 men før steg 5,
   er bilder registrert på sentral server uten organisering. Anbefaling: la
   brukeren starte migrasjonen på nytt — idempotency håndterer dette.

2. **Veldig stor lokal samling:** Re-sending av coldpreviews som base64 kan
   være tregt for samlinger på tusenvis av bilder. Inkrementell migrasjon
   (batching) bør vurderes i implementasjonen.

3. **Lokal database som langsiktig backup:** Skal det finnes en kommando for
   å slette lokal data eksplisitt, etter at brukeren er trygg på at alt er
   overført?
