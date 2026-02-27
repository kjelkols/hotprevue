# API-spesifikasjon

Teknisk API-dokumentasjon genereres automatisk fra kjørende backend (se `scripts/export-api-docs.sh`). Denne filen beskriver designintensjoner, konvensjoner og overordnet struktur.

## Konvensjoner

- **Base64 for all bildebinærdata** — hotpreview leveres som base64-streng i JSON-responser
- **hothash som Photo-ID** — alle photo-endepunkter bruker hothash, ikke intern database-ID
- **PATCH for oppdateringer** — delvise oppdateringer, kun angitte felt endres
- **Feilresponser** følger standard HTTP-statuskoder med JSON-body `{"detail": "..."}`
- **Multipart for filopplasting** — `master_file` som `UploadFile`, metadata som JSON-streng i `metadata`-felt

---

## Endepunkter

### Photos

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/photos` | List photos (filtrering via query-params) |
| `GET` | `/photos/{hothash}` | Hent ett photo med full metadata |
| `PATCH` | `/photos/{hothash}` | Oppdater metadata (taken_at, tags, rating, event, photographer, osv.) |
| `GET` | `/photos/{hothash}/coldpreview` | Hent coldpreview-bilde (JPEG, med korreksjon hvis den finnes) |
| `GET` | `/photos/{hothash}/files` | List ImageFiles tilknyttet photo |
| `POST` | `/photos/{hothash}/companions` | Legg til companion-fil (kun metadata, ingen opplasting) |
| `POST` | `/photos/{hothash}/delete` | Mykt slett photo |
| `POST` | `/photos/{hothash}/restore` | Gjenopprett mykt slettet photo |
| `POST` | `/photos/empty-trash` | Hard-slett alle mykt slettede photos |

**`GET /photos/{hothash}/coldpreview` — respons:**
Returnerer `image/jpeg`. Hvis photo har en aktiv `PhotoCorrection`, appliseres korreksjonene på-farten fra original coldpreview (rotasjon → horisontkorreksjon → crop → eksponering). Original coldpreview på disk røres aldri.

- `ETag` settes til hothash (ingen korreksjon — immutabelt) eller `hothash-<timestamp>` (med korreksjon)
- `Cache-Control: private, max-age=3600`
- `404` hvis photo ikke finnes eller coldpreview-fil mangler

**`POST /photos/{hothash}/companions` — parametere:**
- `path` (string, påkrevd) — originalsti på frontends filsystem
- `type` (string, påkrevd) — `RAW`, `JPEG`, `TIFF`, `PNG`, `HEIC`, `XMP`

Returnerer `409 Conflict` hvis stien allerede er registrert.

### Photos — batch

Alle batch-endepunkter tar `hothashes: []` + operasjonsspesifikke felt. Kjøres best-effort — gyldige photos oppdateres, ugyldige rapporteres i responsen.

**Tags:**

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/photos/batch/tags/add` | Legg til tags (merger med eksisterende) |
| `POST` | `/photos/batch/tags/remove` | Fjern spesifikke tags |
| `POST` | `/photos/batch/tags/set` | Erstatt alle tags |

**Metadata:**

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/photos/batch/rating` | Sett rating |
| `POST` | `/photos/batch/event` | Sett event (`null` = fjern) |
| `POST` | `/photos/batch/category` | Sett kategori (`null` = fjern) |
| `POST` | `/photos/batch/photographer` | Sett fotograf |

**Tid og posisjon:**

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/photos/batch/taken-at` | Sett tidspunkt (med source og accuracy) |
| `POST` | `/photos/batch/taken-at-offset` | Flytt tidspunkt med ±offset (timer/min/sek) |
| `POST` | `/photos/batch/location` | Sett posisjon (med source og accuracy) |

**Livssyklus:**

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/photos/batch/delete` | Mykt slett |
| `POST` | `/photos/batch/restore` | Gjenopprett mykt slettede |

### Input-sesjoner

Frontend scanner katalogen lokalt og sender én gruppe om gangen til backend. Backend leser ikke filsystemet direkte.

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/input-sessions` | Opprett sesjon |
| `GET` | `/input-sessions` | List sesjoner |
| `GET` | `/input-sessions/{id}` | Hent sesjon med løpende statistikk |
| `GET` | `/input-sessions/{id}/photos` | List Photos registrert i sesjonen |
| `GET` | `/input-sessions/{id}/errors` | List filer som feilet i sesjonen |
| `POST` | `/input-sessions/{id}/check` | Sjekk hvilke stier som allerede er registrert |
| `POST` | `/input-sessions/{id}/groups` | Registrer én filgruppe (multipart) |
| `POST` | `/input-sessions/{id}/complete` | Merk sesjonen som ferdig, returner sluttresultat |
| `DELETE` | `/input-sessions/{id}` | Slett sesjon (Photos beholdes) |

**`POST /input-sessions` — parametere:**
- `name` (string, påkrevd)
- `source_path` (string, påkrevd) — informasjonsfelt, frontends lokale katalogsti
- `default_photographer_id` (UUID, påkrevd)
- `default_event_id` (UUID, valgfri)
- `recursive` (bool, standard: `true`) — informasjonsfelt

**`POST /input-sessions/{id}/check` — parametere:**
- `master_paths` (string[], påkrevd) — liste over stier som skal sjekkes

Respons: `{ "known": [...], "unknown": [...] }`. Frontend bruker dette for å filtrere bort allerede registrerte filer før opplasting starter.

**`POST /input-sessions/{id}/groups` — multipart:**
- `master_file` (fil, påkrevd) — binært innhold av masterfilen (JPEG eller annen støttet format)
- `metadata` (string, påkrevd) — JSON med følgende felt:
  - `master_path` (string) — originalsti på frontends filsystem
  - `master_type` (string) — `JPEG`, `RAW`, `PNG`, `TIFF`, `HEIC`
  - `companions` (array, valgfri) — `[{ "path": "...", "type": "..." }]`
  - `photographer_id` (UUID, valgfri) — overstyrer sesjonens standard
  - `event_id` (UUID, valgfri) — overstyrer sesjonens standard

Statuskoder:
- `201` — nytt photo opprettet (`status: "registered"`)
- `200` — duplikat innhold, annen sti (`status: "duplicate"`)
- `200` — sti kjent fra før (`status: "already_registered"`)
- `422` — filen kunne ikke prosesseres (SessionError lagres)

Respons ved 201/200: `{ "status": "...", "hothash": "...", "photo_id": "..." }`

**Sesjonsstatuser:**
- `pending` — opprettet, ingen grupper mottatt ennå
- `uploading` — første gruppe er registrert
- `completed` — `/complete` er kalt

**Anbefalt frontend-flyt:**
```
POST /input-sessions                     → session_id
POST /input-sessions/{id}/check          → filtrer bort kjente stier
[for hver ukjent gruppe:]
  POST /input-sessions/{id}/groups       → 201 / 200 / 422
POST /input-sessions/{id}/complete       → sluttresultat
```

### Duplikater

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/duplicates` | List alle duplikater |
| `DELETE` | `/duplicates/{id}` | Fjern en duplikat-rad manuelt |

**Filtrering for `GET /duplicates`:**
- `session_id` (UUID) — kun duplikater fra én sesjon
- `photo_id` (UUID) — kun duplikater for ett spesifikt photo

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
| `GET` | `/events` | List alle events som trestruktur |
| `GET` | `/events/{id}` | Hent event |
| `PATCH` | `/events/{id}` | Oppdater event (inkl. flytte via `parent_id`) |
| `DELETE` | `/events/{id}` | Slett event — photos beholdes (`event_id` settes til `null`) |

**`GET /events` — trestruktur:**
Returnerer rot-events med children nøstet inn. Hver event inkluderer `photo_count` (direkte tilknyttede Photos).

**`PATCH /events/{id}` — flytte event:**
- Sett `parent_id` til en rot-event for å gjøre eventen til child
- Sett `parent_id` til `null` for å løsrive child-event til rot-event
- Avvises med `409` hvis ny `parent_id` peker på en child-event (ville gitt tre nivåer)
- Avvises med `409` hvis eventen har children og `parent_id` settes (rot-event med children kan ikke flyttes)

**`DELETE /events/{id}`:**
Avvises med `409 Conflict` hvis eventen har child-events.

### Settings

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/settings` | Hent alle innstillinger (inkl. `installation_id`) |
| `PATCH` | `/settings` | Oppdater mutablete felt |

`installation_id` kan ikke endres via API.

---

### Tags

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/tags` | List alle distinkte tags i bruk |

**Parametere:**
- `q` (string, valgfri) — prefiks-filtrering for autocomplete
- `with_count` (bool, valgfri) — inkluder antall Photos per tag

### Categories

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/categories` | List alle kategorier |
| `POST` | `/categories` | Opprett kategori |
| `PATCH` | `/categories/{id}` | Oppdater navn, rekkefølge, strøm-ekskludering |
| `DELETE` | `/categories/{id}` | Slett — setter `category_id = null` på tilknyttede Photos |

### Collections

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/collections` | Opprett collection |
| `GET` | `/collections` | List collections |
| `GET` | `/collections/{id}` | Hent collection med item-antall |
| `PATCH` | `/collections/{id}` | Oppdater navn, beskrivelse |
| `DELETE` | `/collections/{id}` | Slett collection |
| `POST` | `/collections/{id}/clone` | Klon collection til ny (dype kopier av text_items) |
| `GET` | `/collections/{id}/items` | List alle items i rekkefølge (inkl. hotpreview_b64 / markup) |
| `POST` | `/collections/{id}/items` | Legg til foto-element (`hothash`) eller tekst-element (`text_item_id`) |
| `POST` | `/collections/{id}/items/batch` | Legg til flere foto-elementer på én gang |
| `PUT` | `/collections/{id}/items` | Oppdater rekkefølge (tar sortert item_ids-liste) |
| `PATCH` | `/collections/{id}/items/{item_id}` | Oppdater `caption` eller `notes` |
| `DELETE` | `/collections/{id}/items/batch` | Fjern flere elementer på én gang (`item_ids: uuid[]`) |
| `DELETE` | `/collections/{id}/items/{item_id}` | Fjern element (sletter text_item hvis ingen andre referanser) |

**CollectionItem-felter:**
- `hothash` — satt for foto-elementer (null for tekstkort)
- `text_item_id` — satt for tekstkort (null for foto-elementer)
- Nøyaktig ett av de to feltene er alltid satt (CHECK constraint i DB)
- `caption` — bildetekst, vises under bildet i visningsmodus
- `notes` — forelesningsnotater, vises kun i Visningsmodus (aldri i grid)

### TextItems

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/text-items` | Opprett tekstkort (`markup: str`) |
| `GET` | `/text-items/{id}` | Hent tekstkort |
| `PATCH` | `/text-items/{id}` | Oppdater markup |
| `DELETE` | `/text-items/{id}` | Slett (kun hvis ingen collection_items refererer til det) |

**TextItem-felter:**
- `markup` — Markdown (CommonMark); sentrering via CSS i renderer
- Tekstkort deles 1:N mellom collection_items; kloning av collection lager dype kopier

### Stacks

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/stacks` | Opprett stack med ett Photo |
| `GET` | `/stacks` | List alle stacks med coverbilde og antall |
| `GET` | `/stacks/{stack_id}` | Hent alle Photos i en stack |
| `POST` | `/stacks/{stack_id}/photos` | Legg til Photo i stack |
| `POST` | `/stacks/{stack_id}/photos/batch` | Legg til flere photos (best-effort) |
| `DELETE` | `/stacks/{stack_id}/photos/{hothash}` | Fjern Photo fra stack |
| `PUT` | `/stacks/{stack_id}/cover/{hothash}` | Sett coverbilde |
| `DELETE` | `/stacks/{stack_id}` | Slett stack og løs opp alle Photos |

---

## Filtrering (GET /photos)

| Parameter | Type | Beskrivelse |
|---|---|---|
| `photographer_id` | UUID | Filtrer på fotograf |
| `event_id` | UUID | Filtrer på event |
| `session_id` | UUID | Filtrer på input-sesjon |
| `tags` | string[] | AND-filtrering — Photos med *alle* angitte tags |
| `category_id` | UUID | Filtrer på kategori |
| `in_stream` | bool | `true` = ekskluder Photos i strøm-ekskluderte kategorier |
| `rating_min` | int | Minimumsrating (1–5) |
| `rating_max` | int | Maksimumsrating (1–5) |
| `taken_after` | datetime | Tidligste tidspunkt |
| `taken_before` | datetime | Seneste tidspunkt |
| `deleted` | bool | `false` (standard) = aktive. `true` = slettede. |
| `sort` | string | Se Sortering |
| `limit` | int | Maks antall resultater (standard: 100, maks: 1000) |
| `offset` | int | Startposisjon for paginering |

---

## Sortering (GET /photos)

| Verdi | Beskrivelse |
|---|---|
| `taken_at_desc` (standard) | Nyeste tidspunkt først. Photos uten `taken_at` havner sist. |
| `taken_at_asc` | Eldste tidspunkt først. |
| `registered_at_desc` | Sist registrert først. |
| `registered_at_asc` | Først registrert først. |
| `rating_desc` | Høyest rating først. Photos uten rating havner sist. |
| `rating_asc` | Lavest rating først. |

Standard: `taken_at_desc`. Alle sorteringer bruker `registered_at_asc` som sekundær nøkkel for stabil paginering.

---

## Liste vs. detaljrespons

`GET /photos` returnerer en kompakt representasjon. `GET /photos/{hothash}` returnerer full detalj.

**Inkludert i liste:**

| Felt | Begrunnelse |
|---|---|
| `hothash` | Nøkkel-ID |
| `hotpreview_b64` | Nødvendig for gallerivisning |
| `taken_at`, `taken_at_accuracy` | Sortering og visning |
| `rating` | Filtrering og visning |
| `tags` | Filtrering og visning |
| `category_id` | Filtrering |
| `event_id` | Filtrering og visning |
| `photographer_id` | Filtrering og visning |
| `location_lat`, `location_lng`, `location_accuracy` | Kartvisning |
| `stack_id`, `is_stack_cover` | Gallerilogikk |
| `deleted_at` | Søppelkassvisning |
| `has_correction` | Bool — indikerer om korreksjon finnes |
| `camera_make`, `camera_model` | Nyttig i liste |
| `iso`, `shutter_speed`, `aperture`, `focal_length` | Nyttig i liste |

**Kun i detalj (`GET /photos/{hothash}`):**

| Felt | Begrunnelse |
|---|---|
| `exif_data` | Kan være stor — aldri i liste |
| `taken_at_source` | Implementasjonsdetalj |
| `location_source` | Implementasjonsdetalj |
| `input_session_id` | Ikke nødvendig i gallerisammenheng |
| `registered_at` | Ikke nødvendig i gallerisammenheng |
| Full `PhotoCorrection` | Kun nødvendig ved redigering |
| `image_files`-liste | Kun nødvendig i detaljvisning |
