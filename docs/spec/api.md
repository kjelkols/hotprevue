# API-spesifikasjon

Teknisk API-dokumentasjon genereres automatisk fra kjørende backend (se `scripts/export-api-docs.sh`). Denne filen beskriver designintensjoner, konvensjoner og overordnet struktur.

## Konvensjoner

- **Base64 for all bildebinærdata** — hotpreview og coldpreview leveres alltid som base64-strenger i JSON-responser
- **hothash som Photo-ID** — alle photo-endepunkter bruker hothash, ikke intern database-ID
- **PATCH for oppdateringer** — delvise oppdateringer, kun angitte felt endres
- **Feilresponser** følger standard HTTP-statuskoder med JSON-body `{"detail": "..."}`

---

## Endepunkter

### Photos

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/photos` | List photos (filtrering via query-params) |
| `GET` | `/photos/{hothash}` | Hent ett photo med metadata |
| `PATCH` | `/photos/{hothash}` | Oppdater rating, tags, event, beskrivelse, fotograf |
| `DELETE` | `/photos/{hothash}` | Slett metadata og coldpreview |
| `GET` | `/photos/{hothash}/coldpreview` | Last ned coldpreview-fil |
| `GET` | `/photos/{hothash}/files` | List ImageFiles tilknyttet photo |

### Input-sesjoner

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/input-sessions` | Opprett sesjon |
| `GET` | `/input-sessions` | List sesjoner |
| `GET` | `/input-sessions/{id}` | Hent sesjon med statistikk |
| `GET` | `/input-sessions/{id}/photos` | List Photos registrert i sesjonen |
| `GET` | `/input-sessions/{id}/errors` | List filer som feilet i sesjonen |
| `POST` | `/input-sessions/{id}/scan` | Skann kildekatalog, returner gruppesammendrag |
| `POST` | `/input-sessions/{id}/process` | Prosesser og registrer alle grupper |
| `DELETE` | `/input-sessions/{id}` | Slett sesjon (Photos beholdes) |

**Parametere for `POST /input-sessions`:**
- `name` (string, påkrevd)
- `source_path` (string, påkrevd)
- `default_photographer_id` (UUID, påkrevd)
- `default_event_id` (UUID, valgfri — utelat for ingen event-tilknytning)
- `recursive` (bool, standard: `true`)

**Parametere for `POST /input-sessions/{id}/process`:**
- `skip_review` (bool, standard: `false`) — hopper over scan-steget og prosesserer direkte

**Rescan:** En sesjon kan rescanned uavhengig av nåværende status. `scan` og `process` kan kjøres på nytt mot samme `source_path`. Allerede registrerte filer hoppes over stille.

**Merk:** `skip_review: true` er ikke anbefalt for store kataloger — brukeren mister muligheten til å gjennomgå gruppesammendraget før prosessering starter.

### Duplikater

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/duplicates` | List alle duplikater (filtrering via query-params) |
| `DELETE` | `/duplicates/{id}` | Fjern en duplikat-rad manuelt |
| `POST` | `/duplicates/validate` | Sjekk alle filstier, fjern poster for filer som ikke lenger finnes |

**Filtrering for `GET /duplicates`:**
- `session_id` (UUID) — kun duplikater fra én sesjon
- `photo_id` (UUID) — kun duplikater for ett spesifikt photo

**Merk:** Duplikater fjernes også automatisk under neste skanning av samme katalog. `POST /duplicates/validate` kan brukes av brukeren for å rydde opp uten å kjøre en full skanning.

### Fotografer

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/photographers` | Opprett fotograf |
| `GET` | `/photographers` | List fotografer |
| `GET` | `/photographers/{id}` | Hent fotograf |
| `PATCH` | `/photographers/{id}` | Oppdater fotograf |
| `DELETE` | `/photographers/{id}` | Slett fotograf (kun hvis ingen Photos tilknyttet) |

### Events

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/events` | Opprett event |
| `GET` | `/events` | List events med antall photos |
| `GET` | `/events/{id}` | Hent event med tilhørende photos |
| `PATCH` | `/events/{id}` | Oppdater event |
| `DELETE` | `/events/{id}` | Slett event (photos beholdes) |

### Collections

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/collections` | Opprett collection |
| `GET` | `/collections` | List collections |
| `GET` | `/collections/{id}` | Hent collection med photos i rekkefølge |
| `PATCH` | `/collections/{id}` | Oppdater collection |
| `DELETE` | `/collections/{id}` | Slett collection |
| `PUT` | `/collections/{id}/items` | Erstatt hele rekkefølgen |
| `POST` | `/collections/{id}/items` | Legg til photo eller tekstkort |
| `DELETE` | `/collections/{id}/items/{item_id}` | Fjern element |

---

## Filtrering (GET /photos)

| Parameter | Type | Beskrivelse |
|---|---|---|
| `photographer_id` | UUID | Filtrer på fotograf |
| `event_id` | UUID | Filtrer på event |
| `session_id` | UUID | Filtrer på input-sesjon |
| `tags` | string[] | Filtrer på én eller flere tags |
| `rating_min` | int | Minimumsrating (1–5) |
| `rating_max` | int | Maksimumsrating (1–5) |
| `taken_after` | datetime | Tidligste tidspunkt |
| `taken_before` | datetime | Seneste tidspunkt |
| `q` | string | Tekstsøk på beskrivelse |
| `limit` | int | Antall resultater (paginering) |
| `offset` | int | Startposisjon (paginering) |

---

## Registreringsflyt

```
POST /input-sessions                   → opprett sesjon (navn, fotograf, event, sti)
POST /input-sessions/{id}/scan         → skann katalog, returner gruppesammendrag
                                           → bruker gjennomgår og bekrefter
POST /input-sessions/{id}/process      → registrer alle grupper
```

Scan-responsen inneholder:
- Totalt antall grupper
- Antall RAW+JPEG-par (og evt. grupper med 3+ filer — flagget for gjennomgang)
- Antall grupper med kun RAW
- Antall grupper med kun JPEG/annet
- Antall filer som vil bli hoppet over (ukjente filtyper)
- Antall potensielle duplikater (hothash finnes allerede)

Etter prosessering oppdateres sesjonens `photo_count`, `duplicate_count` og `error_count`.
