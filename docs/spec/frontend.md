# Frontend-spesifikasjon

## Teknologi

Ikke låst. Kandidater: React, Vue, Svelte. Kommuniserer med backend via HTTP API.

## Ruter

| Rute | Visning |
|---|---|
| `/` | Hovedgalleri / timeline |
| `/images/:hothash` | Detaljvisning for ett bilde |
| `/events` | Liste over events |
| `/events/:id` | Event med tilhørende bilder |
| `/collections` | Liste over collections |
| `/collections/:id` | Collection i rekkefølge |
| `/import` | Registreringsassistent |
| `/search` | Søk og filtrering |
| `/admin` | Systemstatus, filstivalidering, sesjoner |

## Visninger

### Galleri / timeline
- Grid-visning av hotpreviews
- Stacks vises som ett bilde (coverbilde) med indikator
- Lazy loading og paginering
- Filtrering på event, tags, rating, dato

### Detaljvisning
- Coldpreview i stor størrelse
- Alle metadata: EXIF, tags, rating, event, beskrivelse
- Knapp for å åpne originalfil i eksternt program
- Navigasjon til forrige/neste bilde

### Registreringsassistent
- Velg katalog (eller enkeltfiler)
- Vis fremgang under registrering
- Oppsummering med antall registrerte, duplikater og feil

### Admin
- Status for filstier (ok / missing / modified)
- Batch-oppdatering av stiprefikser
- Oversikt over registreringssesjoner
- Systeminfo (databasestørrelse, antall bilder, coldpreview-størrelse)

## UX-prinsipper

- Originalfilsti alltid synlig i detaljvisning
- Tydelig varsling når originalfil ikke er tilgjengelig
- Ingen destruktive operasjoner uten bekreftelse
- Batch-operasjoner (tagging, rating, event-tilknytning) skal støttes i gallerivisning
