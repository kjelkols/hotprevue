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
| `PATCH` | `/photos/{hothash}` | Oppdater rating, tags, event, fotograf, taken_at, location |
| `POST` | `/photos/{hothash}/reset-time` | Tilbakestill taken_at til original EXIF-verdi |
| `POST` | `/photos/{hothash}/reset-location` | Tilbakestill location til original EXIF GPS-verdi |
| `GET` | `/photos/{hothash}/correction` | Hent visningskorreksjon (null hvis ingen) |
| `PUT` | `/photos/{hothash}/correction` | Sett eller oppdater korreksjon — genererer korrigert coldpreview |
| `DELETE` | `/photos/{hothash}/correction` | Fjern korreksjon og slett korrigert coldpreview |
| `DELETE` | `/photos/{hothash}` | Mykt slett photo (setter `deleted_at`) |
| `POST` | `/photos/{hothash}/restore` | Gjenopprett mykt slettet photo |
| `POST` | `/photos/empty-trash` | Hard-slett alle mykt slettede photos og deres coldpreviews |
| `GET` | `/photos/{hothash}/coldpreview` | Last ned coldpreview-fil |
| `GET` | `/photos/{hothash}/files` | List ImageFiles tilknyttet photo |

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

**Visningskorreksjon:**

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/photos/batch/correction` | Anvend samme korreksjon på alle |

**Livssyklus:**

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/photos/batch/delete` | Mykt slett |
| `POST` | `/photos/batch/restore` | Gjenopprett mykt slettede |

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
| `GET` | `/events` | List alle events som trestruktur |
| `GET` | `/events/{id}` | Hent event med direkte tilknyttede photos |
| `PATCH` | `/events/{id}` | Oppdater event (inkl. flytte via `parent_id`) |
| `DELETE` | `/events/{id}` | Slett event — photos beholdes (`event_id` settes til `null`) |

**`GET /events` — trestruktur:**
Returnerer rot-events med children nøstet inn. Hver event inkluderer `photo_count` (kun direkte tilknyttede Photos).

**`PATCH /events/{id}` — flytte event:**
- Sett `parent_id` til en rot-event for å gjøre eventen til child
- Sett `parent_id` til `null` for å løsrive child-event til rot-event
- Avvises med feil hvis ny `parent_id` peker på en child-event (ville gitt tre nivåer)
- Avvises med feil hvis eventen har children og `parent_id` settes til en annen event (rot-event med children kan ikke flyttes)

**`DELETE /events/{id}`:**
Avvises med `409 Conflict` hvis eventen har child-events. Brukeren må slette children manuelt først.

### Tags

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/tags` | List alle distinkte tags i bruk |

**`GET /tags` — parametere:**
- `q` (string, valgfri) — prefiks-filtrering for autocomplete, f.eks. `?q=sol` returnerer `solnedgang`, `soloppgang`
- `with_count` (bool, valgfri) — inkluder antall Photos per tag

### Categories

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/categories` | List alle kategorier (for dropdown) |
| `POST` | `/categories` | Opprett kategori |
| `PATCH` | `/categories/{id}` | Oppdater navn, rekkefølge, strøm-ekskludering |
| `DELETE` | `/categories/{id}` | Slett — setter `category_id = null` på tilknyttede Photos |

### Collections

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/collections` | Opprett collection |
| `GET` | `/collections` | List collections |
| `GET` | `/collections/{id}` | Hent collection med photos i rekkefølge |
| `PATCH` | `/collections/{id}` | Oppdater collection |
| `DELETE` | `/collections/{id}` | Slett collection |
| `POST` | `/collections/{id}/items/batch` | Legg til flere photos (best-effort) |
| `PUT` | `/collections/{id}/items` | Oppdater rekkefølge — send sortert liste av item-IDer |
| `POST` | `/collections/{id}/items` | Legg til photo eller tekstkort (legges til bakerst) |
| `PATCH` | `/collections/{id}/items/{item_id}` | Oppdater caption, title eller text_content |
| `DELETE` | `/collections/{id}/items/{item_id}` | Fjern element |

**`PUT /collections/{id}/items`** tar inn en sortert liste av eksisterende item-IDer og oppdaterer kun `position`. Innhold (caption, text_content) røres ikke. Nye items legges til via `POST`, ikke via `PUT`.

**`POST /collections/{id}/items`** — parametere:
- For photo: `hothash` (string, påkrevd)
- For tekstkort: `is_text_card: true`, `title` (string, valgfri), `text_content` (string, valgfri)

### Stacks

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/stacks` | Opprett stack med ett Photo — blir automatisk coverbilde |
| `GET` | `/stacks` | List alle stacks med coverbilde og antall Photos |
| `GET` | `/stacks/{stack_id}` | Hent alle Photos i en stack |
| `POST` | `/stacks/{stack_id}/photos` | Legg til Photo i stack |
| `POST` | `/stacks/{stack_id}/photos/batch` | Legg til flere photos (best-effort) |
| `DELETE` | `/stacks/{stack_id}/photos/{hothash}` | Fjern Photo fra stack |
| `PUT` | `/stacks/{stack_id}/cover/{hothash}` | Sett coverbilde |
| `DELETE` | `/stacks/{stack_id}` | Slett hele stacken og løs opp alle Photos |

**Parametere for `POST /stacks`:**
- `hothash` (string, påkrevd) — Photo som blir første og eneste medlem, settes automatisk som coverbilde

**Parametere for `POST /stacks/{stack_id}/photos`:**
- `hothash` (string, påkrevd) — Photo som legges til. Returnerer `409 Conflict` hvis Photo allerede tilhører en annen stack.

**Automatisk coverbilde:** Hvis coverbilde fjernes fra stacken via `DELETE /stacks/{stack_id}/photos/{hothash}`, settes det første gjenværende Photo automatisk som nytt coverbilde.

**Automatisk sletting:** Hvis siste Photo fjernes fra en stack, slettes stacken automatisk. Eksplisitt `DELETE /stacks/{stack_id}` løser opp alle Photos uten å slette dem.

---

## Filtrering (GET /photos)

| Parameter | Type | Beskrivelse |
|---|---|---|
| `photographer_id` | UUID | Filtrer på fotograf |
| `event_id` | UUID | Filtrer på event |
| `session_id` | UUID | Filtrer på input-sesjon |
| `tags` | string[] | Filtrer på tags — standard AND (Photos med *alle* angitte tags). |
| `category_id` | UUID | Filtrer på kategori. `null` = Photos uten kategori. |
| `in_stream` | bool | `true` = kun Photos der kategorien ikke er ekskludert fra strøm (inkl. Photos uten kategori) |
| `rating_min` | int | Minimumsrating (1–5) |
| `rating_max` | int | Maksimumsrating (1–5) |
| `taken_after` | datetime | Tidligste tidspunkt |
| `taken_before` | datetime | Seneste tidspunkt |
| `deleted` | bool | `false` (standard) = kun aktive. `true` = kun slettede. Utelat for kun aktive. |
| `sort` | string | Sorteringsfelt — se Sortering nedenfor |
| `limit` | int | Antall resultater (paginering) |
| `offset` | int | Startposisjon (paginering) |

**Utvidelsespunkt:** `tags` og `category_id` er designet som array-parametere — initielt aksepteres én verdi, men parameteren er strukturert slik at følgende kan legges til uten breaking changes:
- `?category_id=id1&category_id=id2` — filtrer på flere kategorier (OR)
- `?exclude_category_id=id1&exclude_category_id=id2` — ekskluder én eller flere kategorier
- `?tag_operator=or` — bytt tags-filtrering fra AND til OR

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
| `hotpreview_b64` | Nødvendig for gallerivisning — rimelig størrelse for lokalt system |
| `taken_at`, `taken_at_accuracy` | Nødvendig for sortering og visning |
| `rating` | Nødvendig for filtrering og visning |
| `tags` | Nødvendig for filtrering og visning |
| `category_id` | Nødvendig for filtrering |
| `event_id` | Nødvendig for filtrering og visning |
| `photographer_id` | Nødvendig for filtrering og visning |
| `location_lat`, `location_lng`, `location_accuracy` | Nødvendig for kartvisning og visning |
| `stack_id`, `is_stack_cover` | Nødvendig for gallerilogikk |
| `deleted_at` | Nødvendig for søppelkassvisning |
| `has_correction` | Bool — indikerer om korreksjon finnes (frontend kan hente detaljer ved behov) |
| `camera_make`, `camera_model` | Liten overhead — nyttig i liste |
| `iso`, `shutter_speed`, `aperture`, `focal_length` | Liten overhead — nyttig i liste |

**Kun i detalj (`GET /photos/{hothash}`):**

| Felt | Begrunnelse |
|---|---|
| `coldpreview_path` | Kun nødvendig ved visning av enkeltbilder |
| `exif_data` | Rå EXIF — kan være stor. Aldri i liste. |
| `taken_at_source` | Implementasjonsdetalj — ikke nødvendig i liste |
| `location_source` | Implementasjonsdetalj — ikke nødvendig i liste |
| `input_session_id` | Ikke nødvendig i gallerisammenheng |
| `registered_at` | Ikke nødvendig i gallerisammenheng |
| Full `PhotoCorrection`-objekt | Kun nødvendig ved redigering |
| `ImageFiles`-liste | Kun nødvendig i detaljvisning |

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
