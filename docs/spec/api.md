# API-spesifikasjon

Teknisk API-dokumentasjon genereres automatisk fra kjørende backend (se `scripts/export-api-docs.sh`). Denne filen beskriver designintensjoner, konvensjoner og overordnet struktur.

## Konvensjoner

- **Base64 for all bildebinærdata** — hotpreview og coldpreview leveres alltid som base64-strenger i JSON-responser
- **hothash som bilde-ID** — alle bilde-endepunkter bruker hothash, ikke intern database-ID
- **PATCH for oppdateringer** — delvise oppdateringer, kun angitte felt endres
- **Feilresponser** følger standard HTTP-statuskoder med JSON-body `{"detail": "..."}`

## Endepunkter

### Bilder

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/images/register` | Registrer bilde fra filsti |
| `GET` | `/images` | List bilder (filtrering via query-params) |
| `GET` | `/images/{hothash}` | Hent ett bilde med metadata |
| `PATCH` | `/images/{hothash}` | Oppdater rating, tags, event, beskrivelse |
| `DELETE` | `/images/{hothash}` | Slett metadata og coldpreview |
| `GET` | `/images/{hothash}/coldpreview` | Last ned coldpreview-fil |

### Events

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/events` | Opprett event |
| `GET` | `/events` | List events med bildeantall |
| `GET` | `/events/{id}` | Hent event med tilhørende bilder |
| `PATCH` | `/events/{id}` | Oppdater event |
| `DELETE` | `/events/{id}` | Slett event (bilder beholdes) |

### Collections

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/collections` | Opprett collection |
| `GET` | `/collections` | List collections |
| `GET` | `/collections/{id}` | Hent collection med bilder i rekkefølge |
| `PATCH` | `/collections/{id}` | Oppdater collection |
| `DELETE` | `/collections/{id}` | Slett collection |
| `PUT` | `/collections/{id}/items` | Erstatt hele rekkefølgen |
| `POST` | `/collections/{id}/items` | Legg til bilde eller tekstkort |
| `DELETE` | `/collections/{id}/items/{item_id}` | Fjern element |

### Registreringssesjoner

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/sessions/register` | Start registrering av en katalog |
| `GET` | `/sessions` | List sesjoner |
| `GET` | `/sessions/{id}` | Hent sesjon med tilhørende bilder |

## Filtrering (GET /images)

| Parameter | Type | Beskrivelse |
|---|---|---|
| `event_id` | int | Filtrer på event |
| `tags` | string[] | Filtrer på én eller flere tags |
| `rating_min` | int | Minimumsrating |
| `rating_max` | int | Maksimumsrating |
| `taken_after` | datetime | Tidligste tidspunkt |
| `taken_before` | datetime | Seneste tidspunkt |
| `q` | string | Tekstsøk på filnavn og beskrivelse |
| `limit` | int | Antall resultater (paginering) |
| `offset` | int | Startposisjon (paginering) |
