# ADR-017: Sporing av originalfilers lagringssted

**Status:** Planlagt  
**Dato:** 2026-06-03

## Kontekst

Hotprevue registrerer metadata og previews fra originalfiler, men flytter eller
kopierer aldri originalfilene selv. `file_path` i `image_files`-tabellen peker
til filen slik den lå da den ble registrert — denne verdien oppdateres aldri.

Brukeren kan flytte originalfiler fritt: til ekstern disk, optisk arkiv (Bluray),
kold sky-lagring (Amazon Glacier), NAS, eller offline-medier — med hvilket som
helst program. Companion-filer (RAW, JPEG, XMP) er brukerens ansvar ved
slik flytting.

Etter en slik operasjon er `file_path` ugyldig og originalen kan ikke lokaliseres
automatisk. Coldpreview og hotpreview er alltid tilgjengelig i systemet uavhengig
av originalens tilgjengelighet.

Eksisterende felt på `ImageFile` som er designet for dette formålet:
- `file_content_hash` — SHA256 av originalfilen, muliggjør fremtidig gjenfinning
- `last_verified_at` — sist bekreftet at filen fantes på `file_path`
- `file_size_bytes` — støtter match-verifisering

## Beslutning

### Scenarioer

| Scenario | Original tilgjengelig? |
|----------|----------------------|
| Fil på NAS / Filserver | Ja |
| Fil på ekstern disk, tilkoblet | Ja |
| Fil på ekstern disk, offline | Nei |
| Fil på Bluray / BD-R | Nei |
| Fil på Amazon Glacier | Nei (koster å hente) |
| Fil slettet / tapt | Nei, permanent |

I alle scenarioer: hotpreview og coldpreview er alltid tilgjengelig.

### Domenemodell

```
StorageLocation (Lagringssted)
  id
  name          — "Bluray-samling stuen", "Amazon S3 Glacier", "WD 4TB rød"
  medium_type   — optical | external_disk | nas | cloud_cold | cloud_warm | local
  is_online     — bool: kan filen nås akkurat nå?
  notes         — fritekst

ArchiveEntry (Arkivlogg)
  id
  storage_location_id  → StorageLocation
  note          — "Alle RAW-filer fra 2024, familiebilder, sortert per event"
  archived_at   — datetime
  photo_count   — int (informasjon)
  archived_by   → Photographer

ArchiveEntryPhoto (kobling)
  archive_entry_id  → ArchiveEntry
  photo_id          → Photo
```

Denormalisert snarvei: `photos.archive_entry_id` (nullable FK) for å vise
arkivstatus direkte i visninger uten ekstra JOIN.

### Brukerflyt

```
1. Bruker velger N bilder i BrowseView
2. Høyreklikk → "Arkiver til lagringssted…"
3. Velg eksisterende lagringssted eller opprett nytt
4. Valgfritt notat: "Brennt til BD-R disc #12, eske i stuen"
5. Systemet oppretter ArchiveEntry og kobler alle N bilder
```

På fotodetalj-siden:
```
Original: /Filserver/2024/IMG_1234.CR3  [Ikke verifisert siden 2026-03-01]
Arkivert: Bluray-samling stuen • 2026-05-15
          "Brennt til BD-R disc #12, eske i stuen"
```

### Fremtidig gjenfinningshjelp

`file_content_hash` muliggjør automatisk gjenfinning når brukeren kobler til
en disk igjen:

1. Bruker velger "Skann etter originaler" i Lokale verktøy og peker på en mappe
2. Agenten beregner SHA256 for hver fil i mappen
3. Treff mot `file_content_hash` → `file_path` og `last_verified_at` oppdateres
4. Ingen treff → original er på en annen disk; arkivnotat vises

Gjenfinningsverktøyet hører til under **Lokale verktøy** siden det krever
filsystemtilgang via den lokale agenten.

## Konsekvenser

### Ikke i scope for dette ADR
- Automatisk sporing av om `file_path` er gyldig (polling / inotify)
- Synkronisering av filflytting på tvers av maskiner
- Integrasjon med sky-APIer (S3, Glacier) for å sjekke tilgjengelighet

### Hva som må implementeres
1. Databasemigrering: `storage_locations`, `archive_entries`, `archive_entry_photos`
   tabeller + `photos.archive_entry_id`
2. Backend-API: CRUD for StorageLocation og ArchiveEntry, batch-kobling av bilder
3. Frontend: arkiveringsflyt i BrowseView (bulk-handling), visning på PhotoDetailPage
4. Lokale verktøy: gjenfinningsverktøy med SHA256-skanning via agenten

### Eksisterende infrastruktur som gjenbrukes
- `image_files.file_content_hash` — klar for gjenfinning
- `image_files.last_verified_at` — klar for å vise verifiseringsstatus
- Lokal agent (port 8002) — håndterer filsystemtilgang for skanning
