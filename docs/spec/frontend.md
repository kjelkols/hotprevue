# Frontend-spesifikasjon

## Teknologi

Ikke låst. Kandidater: React, Vue, Svelte. Kommuniserer med backend via HTTP API.

## Ruter

| Rute | Visning |
|---|---|
| `/` | Hovedgalleri / timeline |
| `/photos/:hothash` | Detaljvisning for ett photo |
| `/events` | Liste over events |
| `/events/:id` | Event med tilhørende photos |
| `/collections` | Liste over collections |
| `/collections/:id` | Collection i rekkefølge |
| `/input-sessions` | Registreringsassistent |
| `/input-sessions/:id` | Pågående eller fullført sesjon |
| `/photographers` | Liste over fotografer |
| `/photographers/:id` | Fotograf med tilhørende photos |
| `/duplicates` | Oversikt over duplikatfiler |
| `/search` | Søk og filtrering |
| `/admin` | Systemstatus, filstivalidering, sesjoner |

## Visninger

### Galleri / timeline
- Grid-visning av hotpreviews
- Stacks vises som ett photo (coverbilde) med indikator
- Lazy loading og paginering
- Filtrering på fotograf, event, tags, rating, dato, kategori

### Detaljvisning
- Coldpreview i stor størrelse
- Alle metadata: EXIF, tags, rating, event, fotograf, kategori
- Liste over tilknyttede ImageFiles med filtype og sti
- Knapp for å åpne originalfil i eksternt program
- Navigasjon til forrige/neste photo

### Registreringsassistent
- Opprett input-sesjon: navn, fotograf, kildekatalog
- Skann-steg: vis gruppesammendrag før prosessering
- Fremgangsvisning under registrering
- Oppsummering: antall registrerte, duplikater og feil

### Admin
- Status for filstier (ok / missing / modified)
- Batch-oppdatering av stiprefikser
- Oversikt over input-sesjoner
- Systeminfo (databasestørrelse, antall photos, coldpreview-størrelse)

## UX-prinsipper

- Originalfilsti alltid synlig i detaljvisning
- Tydelig varsling når originalfil ikke er tilgjengelig
- Ingen destruktive operasjoner uten bekreftelse
- Batch-operasjoner (tags, rating, event-tilknytning, kategori) skal støttes i gallerivisning
