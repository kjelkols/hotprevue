# API-spesifikasjon

Teknisk API-dokumentasjon genereres automatisk fra kjørende backend (se `scripts/export-api-docs.sh`). Denne filen beskriver designintensjoner, konvensjoner og overordnet struktur.

## Konvensjoner

- **Base64 for all bildebinærdata** — hotpreview og coldpreview leveres alltid som base64-strenger i JSON-responser
- **hothash som Photo-ID** — alle photo-endepunkter bruker hothash, ikke intern database-ID
- **PATCH for oppdateringer** — delvise oppdateringer, kun angitte felt endres
- **Feilresponser** følger standard HTTP-statuskoder med JSON-body `{"detail": "..."}`

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
| `POST` | `/input-sessions` | Opprett sesjon (navn, kildekatalog, fotograf) |
| `GET` | `/input-sessions` | List sesjoner |
| `GET` | `/input-sessions/{id}` | Hent sesjon med tilhørende photos |
| `POST` | `/input-sessions/{id}/scan` | Skann kildekatalog, returner gruppesammendrag |
| `POST` | `/input-sessions/{id}/process` | Prosesser og registrer alle grupper |
| `DELETE` | `/input-sessions/{id}` | Slett sesjon (photos beholdes) |

`POST /input-sessions/{id}/process` aksepterer en valgfri parameter `skip_review: bool` (default `false`). Med `skip_review: true` kombineres skann og prosessering i ett kall.

### Fotografer

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/photographers` | Opprett fotograf |
| `GET` | `/photographers` | List fotografer |
| `GET` | `/photographers/{id}` | Hent fotograf |
| `PATCH` | `/photographers/{id}` | Oppdater fotograf |
| `DELETE` | `/photographers/{id}` | Slett fotograf (kun hvis ingen photos) |

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

## Filtrering (GET /photos)

| Parameter | Type | Beskrivelse |
|---|---|---|
| `photographer_id` | UUID | Filtrer på fotograf |
| `event_id` | UUID | Filtrer på event |
| `session_id` | UUID | Filtrer på input-sesjon |
| `tags` | string[] | Filtrer på én eller flere tags |
| `rating_min` | int | Minimumsrating |
| `rating_max` | int | Maksimumsrating |
| `taken_after` | datetime | Tidligste tidspunkt |
| `taken_before` | datetime | Seneste tidspunkt |
| `q` | string | Tekstsøk på beskrivelse |
| `limit` | int | Antall resultater (paginering) |
| `offset` | int | Startposisjon (paginering) |

## Registreringsflyt

```
POST /input-sessions              → opprett sesjon
POST /input-sessions/{id}/scan   → skann katalog, få gruppesammendrag
POST /input-sessions/{id}/process → registrer alle grupper
```

Scan-responsen inneholder:
- Totalt antall grupper
- Antall RAW+JPEG-par
- Antall grupper med kun RAW
- Antall grupper med kun JPEG/annet
- Liste over grupper med 3+ filer (flagget for brukergjennomgang)
- Antall filer som vil bli hoppet over (ukjente filtyper)
