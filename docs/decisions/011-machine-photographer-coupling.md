# 011 — Maskin-fotograf-kobling og maskin-felt på photo

## Status

Implementert (2026-03-25)

## Kontekst

Med klient-server-splitten (ADR-008) kan flere maskiner registrere bilder mot samme backend.
Det trengtes en avklaring av tre spørsmål:

1. Skal en maskin knyttes til en fotograf?
2. Hvor i datamodellen lagres informasjon om hvilken maskin som registrerte et bilde?
3. Kan fotograf-tilknytning overstyres av brukeren?

## Beslutning

### Maskin har én fotograf (påkrevd)

`machines.photographer_id` er ikke nullable. Hver maskin må knyttes til én fotograf
ved registrering. Dette gir en naturlig default: bilder registrert fra en maskin
tilordnes maskinens fotograf automatisk.

Koblingen er løs i den forstand at `photos.photographer_id` kan endres av brukeren
i etterkant — uavhengig av hvilken maskin som registrerte bildet.

### Maskin lagres kun på photo

`registered_by_machine_id` legges på `photos`-tabellen. Den lagres ikke på
`image_files` eller andre tabeller.

Begrunnelse for dette skillet:
- `image_file` er et teknisk tilgangspunkt for råfiler (sti, hash, filstørrelse).
  Den vet ikke hvem som eier filen — det er ikke filens ansvar.
- `photo` er brukerens record: her hører eierskap, attribuering og maskin-kontekst hjemme.

### Collection har én bidragsyter (påkrevd)

`collections.photographer_id` er ikke nullable. En collection må alltid ha en
navngitt bidragsyter fra `photographers`-tabellen. Dette kan være en annen person
enn fotografene bak de enkelte bildene i samlingen.

### Fotograf-feltet kan endres av bruker

Brukeren kan endre `photographer_id` på enkeltbilder og collections etter registrering.
Dette er en bevisst attribusjon — ikke en teknisk låsing.

## Datamodell

```
photographers: id, name, ...

machines: id, machine_name, photographer_id (NOT NULL) → photographers.id, ...

photos: ...,
        photographer_id (NOT NULL) → photographers.id,   ← kan endres av bruker
        registered_by_machine_id (nullable) → machines.id

collections: ...,
             photographer_id (NOT NULL) → photographers.id   ← kan endres av bruker
```

`registered_by_machine_id` er nullable fordi det kan finnes eldre bilder registrert
før machines-tabellen ble innført, eller bilder registrert på annen måte.

## Begrunnelse

- Maskin uten fotograf-kobling gir ingen nytteverdi — en anonym maskin sier ingenting
  om hvem som eier bildene den registrerer
- Løs kobling gir fleksibilitet: én person kan bruke flere maskiner, og bilder kan
  omattribueres uten at maskin-historikken endres
- Collection-bidragsyteren kan være en kurator, redaktør eller annen person enn
  fotografen — dette er et bevisst valg

## Konsekvenser

- `machines`-modellen må oppdateres med `photographer_id`
- `photos`-modellen må oppdateres med `registered_by_machine_id`
- `collections`-modellen må oppdateres med `photographer_id`
- Ny alembic-migrasjon nødvendig
- Klienten må sende `machine_id` ved registrering av bilder

## Note: Push-kompatibilitet

`photos.photographer_id` er NOT NULL og er en FK til `photographers.id` (UUID).
For at Push (lokal → sentral server) skal fungere i fremtiden, **må photographer
UUID genereres på sentralserveren** — aldri lokalt på maskinen.

Hvis en lokal maskin genererer sin egen photographer UUID, vil den UUID-en ikke
finnes på sentralserveren, og push av bilder vil feile på FK-referansen.

**Implementasjonskrav:** Når maskinregistrering implementeres, må flyten være:

```
1. Lokal maskin registrerer seg mot sentral server (POST /machines)
2. Sentral server oppretter photographer + machine, returnerer begge UUIDs
3. Lokal maskin lagrer photographer_id og machine_id permanent
4. Alle lokalt registrerte bilder bruker denne photographer_id
```

Ved ren lokal installasjon (ingen sentral server) genereres UUID lokalt —
men dette låser maskinen til lokal-modus inntil en eksplisitt
"koble til sentral server"-operasjon kjøres og UUID-en synkroniseres.

Se også: `docs/spec/push.md` — seksjon "Arkitektoniske forutsetninger"
