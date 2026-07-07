# API-spesifikasjon

Teknisk API-dokumentasjon genereres automatisk fra kjørende backend (se `scripts/export-api-docs.sh` og `/docs` i FastAPI). Denne filen beskriver konvensjoner og gir en menneskelig lesbar endepunktoversikt. Ved avvik er koden i `backend/api/` fasit — oppdater denne filen.

## Konvensjoner

- **JSON overalt** — også bildebinærdata: hotpreview og coldpreview sendes som base64-strenger ved registrering. Ingen multipart-opplasting (ADR-008/024).
- **hothash som Photo-ID** — alle photo-endepunkter bruker hothash, ikke intern database-ID.
- **PATCH for oppdateringer** — delvise oppdateringer, kun angitte felt endres (`exclude_unset`).
- **Feilresponser** følger standard HTTP-statuskoder med JSON-body `{"detail": "..."}`.
- **Batch best-effort** — batch-endepunkter tar `hothashes: []`, oppdaterer det som er gyldig og rapporterer resten i responsen.
- **Autentisering** — maskiner sender `Authorization: Bearer <token>` (ADR-040). Forespørsler uten token behandles i dag som eier (bak Tailscale); nettlesere identifiserer fotograf via header satt av frontend (ADR-012/044).

---

## Autentisering og administrasjon

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/auth/enroll` | Innrulller maskin med invitasjonskode → API-token |
| `POST` | `/auth/add-machine-code` | Lag engangskode for å knytte ny maskin til eksisterende fotograf |
| `GET` | `/admin/backup` | Last ned databasedump |
| `POST` | `/admin/invite-codes` | Opprett invitasjonskode (access_level, målfotograf) |
| `GET` | `/admin/invite-codes` | List invitasjonskoder |
| `DELETE` | `/admin/invite-codes/{code_id}` | Slett invitasjonskode |
| `GET` | `/admin/machines` | List maskiner med token-status |
| `PATCH` | `/admin/machines/{machine_id}` | Oppdater maskin (navn m.m.) |
| `DELETE` | `/admin/machines/{machine_id}/token` | Trekk tilbake maskinens token |
| `GET` | `/admin/photographers` | List fotografer med maskiner |
| `PATCH` | `/admin/photographers/{id}/access-level` | Sett `owner`/`guest` |

## Maskiner (ADR-011)

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/machines` | Registrer maskin (`machine_name`, `photographer_id?`) |
| `GET` | `/machines` | List maskiner |
| `GET` | `/machines/{machine_id}` | Hent én maskin |

## Photos

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/photos/check-hothashes` | Duplikatsjekk før registrering: `{hothashes: []}` → `{known, unknown}` |
| `GET` | `/photos` | List photos (se Filtrering) |
| `GET` | `/photos/timeline` | Tidslinjebøtter for zoom-tidslinjen (ADR-033) |
| `GET` | `/photos/timeline/events` | Event-ballonger til tidslinjen |
| `GET` | `/photos/{hothash}` | Full detalj |
| `GET` | `/photos/{hothash}/files` | ImageFiles tilknyttet photo |
| `GET` | `/photos/{hothash}/download` | Original nedlastingsproxy — henter fil via maskin som har den |
| `GET` | `/photos/{hothash}/coldpreview` | Coldpreview-JPEG, korreksjoner anvendt på-farten |
| `POST` | `/photos/{hothash}/companions` | Registrer companion-fil (kun metadata) |
| `PATCH` | `/photos/{hothash}` | Oppdater metadata |
| `PATCH` | `/photos/{hothash}/correction` | Delvis oppdatering av visningskorreksjon (ADR-028) |
| `DELETE` | `/photos/{hothash}/correction` | Fjern visningskorreksjon |
| `POST` | `/photos/{hothash}/delete` | Mykt slett |
| `POST` | `/photos/{hothash}/restore` | Gjenopprett |
| `POST` | `/photos/empty-trash` | Hard-slett alle mykt slettede (inkl. coldpreview-filer) |
| `POST` | `/photos/compute-perceptual-hashes` | Beregn manglende perseptuelle hasher (ADR-004) |

**`GET /photos/{hothash}/coldpreview`:** returnerer `image/jpeg`. Aktiv `PhotoCorrection` appliseres på-farten (rotation → flip → horisont → crop → eksponering); original coldpreview på disk røres aldri. `ETag` = hothash (uten korreksjon) eller `hothash-<timestamp>`; `Cache-Control: private, max-age=3600`.

### Photos — batch

`POST /photos/batch/…`: `rating`, `event`, `category`, `photographer`, `taken-at`, `taken-at-offset`, `location`, `delete`, `restore`. Alle tar `hothashes: []` + operasjonsspesifikke felt; `null` fjerner verdien der det gir mening. Tid/posisjon settes med source og accuracy (se `domain.md`, ADR-043).

## Registrering (input-sesjoner)

Klientdrevet flyt (ADR-024): agenten skanner og hasher, frontend sjekker `POST /photos/check-hothashes` (sesjonsuavhengig), og først når det finnes nye bilder opprettes en sesjon.

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/input-sessions` | Opprett sesjon (`name`, `source_path`, `default_photographer_id`, `default_event_id?`, `recursive`) |
| `GET` | `/input-sessions` | List sesjoner |
| `GET` | `/input-sessions/{id}` | Hent sesjon med løpende statistikk |
| `GET` | `/input-sessions/{id}/photos` | Photos registrert i sesjonen |
| `GET` | `/input-sessions/{id}/errors` | Filer som feilet |
| `POST` | `/input-sessions/{id}/groups` | Registrer én prosessert gruppe (JSON) |
| `POST` | `/input-sessions/{id}/complete` | Fullfør sesjonen |
| `DELETE` | `/input-sessions/{id}` | Slett sesjon (Photos beholdes) |

**`POST /input-sessions/{id}/groups`** (`GroupPayload`, JSON): hothash, hotpreview og coldpreview som base64, EXIF, filmetadata (master + companions), valgfri `machine_id`, `event_id` (per gruppe, fra katalogkartet) og kvalitetsmetrikker (`sharpness_score`, `exposure_mean`, `exposure_clipping`, `noise_score`, ADR-021). Backend lagrer metadata og skriver coldpreview til disk.

Sesjonsstatuser: `pending` → `uploading` → `completed`.

## Events

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/events` | Opprett |
| `GET` | `/events` | List som trestruktur (children nøstet, `photo_count` = direkte tilknyttede) |
| `GET` | `/events/{id}` | Hent |
| `PATCH` | `/events/{id}` | Oppdater, inkl. flytte via `parent_id` |
| `POST` | `/events/{id}/auto-date` | Sett datospenn fra tilknyttede photos |
| `DELETE` | `/events/{id}` | Slett — `409` hvis children finnes; photos får `event_id = null` |

Hierarkiregler: maks to nivåer; rot-event med children kan ikke gjøres til child (`409`).

## Collections og tekstkort

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/collections` | Opprett |
| `GET` | `/collections` | List |
| `GET` | `/collections/{id}` | Hent med item-antall |
| `PATCH` | `/collections/{id}` | Oppdater navn, beskrivelse, `cover_hothash` |
| `DELETE` | `/collections/{id}` | Slett |
| `GET` | `/collections/{id}/export` | Eksporter collection (zip) |
| `GET` | `/collections/{id}/items` | List items i rekkefølge |
| `POST` | `/collections/{id}/items` | Legg til foto- (`hothash`) eller tekst-element (`text_item_id`) |
| `POST` | `/collections/{id}/items/batch` | Legg til flere foto-elementer |
| `PUT` | `/collections/{id}/items` | Ny rekkefølge (sortert item_ids-liste, kun `position` endres) |
| `PATCH` | `/collections/{id}/items/{item_id}` | Oppdater `caption`/`notes` |
| `DELETE` | `/collections/{id}/items/batch` | Fjern flere (`item_ids`) |
| `DELETE` | `/collections/{id}/items/{item_id}` | Fjern element |

CollectionItem har nøyaktig ett av `hothash`/`text_item_id` satt (CHECK constraint). TextItems (`/text-items`, CRUD) er Markdown-tekstkort som kan deles mellom items.

## Stacks

| Metode | Sti | Beskrivelse |
|---|---|---|
| `POST` | `/stacks` | Opprett stack av hothash-liste |
| `GET` | `/stacks` | List med cover og antall |
| `GET` | `/stacks/{stack_id}` | Hent med alle photos |
| `POST` | `/stacks/{stack_id}/photos/{hothash}` | Legg til ett photo |
| `POST` | `/stacks/{stack_id}/photos/batch` | Legg til flere |
| `DELETE` | `/stacks/{stack_id}/photos/{hothash}` | Fjern photo fra stack |
| `POST` | `/stacks/remove-photos` | Fjern photos fra sine stacks (hothash-liste) |
| `POST` | `/stacks/dissolve` | Oppløs stackene photos-listen tilhører |
| `PUT` | `/stacks/{stack_id}/cover/{hothash}` | Sett coverbilde |
| `DELETE` | `/stacks/{stack_id}` | Slett stack, løs alle photos |

## Tags (ADR-035)

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/tags` | List med bruksantall |
| `GET` | `/tags/similar` | Likhetsøk (trigram) — brukt ved oppretting |
| `POST` | `/tags` | Opprett |
| `PATCH` | `/tags/{tag_id}` | Endre navn |
| `DELETE` | `/tags/{tag_id}` | Slett |
| `POST` | `/tags/{source_id}/merge-into/{target_id}` | Slå sammen |
| `POST` | `/tags/for-photos` | Tags per hothash for et sett photos |
| `POST` | `/tags/{tag_id}/add-to-photos` | Sett tag på hothash-liste |
| `POST` | `/tags/{tag_id}/remove-from-photos` | Fjern tag fra hothash-liste |

## Kinds (ADR-034)

`/kinds` — full CRUD (`POST`, `GET`, `GET /{id}`, `PATCH`, `DELETE`). Kind har navn, farge, `hidden_by_default`, `sort_order`, `is_default`.

## Fotografer

`/photographers` — full CRUD. Sletting avvises hvis photos er tilknyttet. Tilgangsnivå settes via `/admin/photographers/{id}/access-level`.

## Søk (ADR-023/026)

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/searches` | List lagrede søk |
| `POST` | `/searches` | Lagre søk (`logic` AND/OR + `criteria`-liste, JSONB) |
| `POST` | `/searches/execute` | Kjør kriterier direkte → photos |
| `POST` | `/searches/timeline` | Kjør kriterier → tidslinjegruppering |
| `GET/PATCH/DELETE` | `/searches/{search_id}` | Hent / oppdater / slett |

## AI (ADR-022)

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/ai/search` | Semantisk søk (CLIP) |
| `GET` | `/ai/jobs` | Jobber til worker: photos som mangler analyse |
| `POST` | `/ai/results` | Worker leverer resultater |
| `GET` | `/ai/status` | Analysestatus per capability |

## Deling (ADR-045)

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/share/photo/{hothash}` | Delingsinfo for visningssiden |
| `GET` | `/share/photo/{hothash}/og` | HTML med OpenGraph-metatagger |
| `POST` | `/share/photo/{hothash}/public` | Publiser til relay → offentlig lenke |
| `DELETE` | `/share/photo/{hothash}/public` | Trekk tilbake offentlig lenke |
| `GET` | `/share/photo/{hothash}/download` | Nedlasting fra delingssiden |

## System

| Metode | Sti | Beskrivelse |
|---|---|---|
| `GET` | `/system/lock` | Låsestatus (ADR-010) |
| `POST` | `/system/lock` | Ta lås — `409` hvis holdt; 30 min TTL |
| `DELETE` | `/system/lock/{lock_type}` | Slipp lås |
| `POST` | `/system/folder-event-lookup` | `{paths: []}` → eksisterende event per katalog (ADR-024) |

## Øvrig

- `/settings` — `GET` (alt, inkl. `installation_id`), `PATCH /settings/global`, `PATCH /settings/machine` (per maskin, JSONB).
- `/shortcuts` — katalogsnarveier per maskin: CRUD + `move-up`/`move-down`.
- `/stats` — `GET`: nøkkeltall til Hjem-siden.
- `/file-copy-operations` — logg over kopioperasjoner fra Lokale verktøy (ADR-017): CRUD, `suggest-name`, `skips`, `link-session`.

---

## Filtrering (`GET /photos`)

| Parameter | Type | Beskrivelse |
|---|---|---|
| `hothash` | string[] | Hent spesifikke photos |
| `photographer_id` | UUID | Filtrer på fotograf |
| `event_id` | UUID | Filtrer på event |
| `session_id` | UUID | Filtrer på input-sesjon |
| `kind_id` | UUID[] | Filtrer på kind (flere = OR) |
| `category_id` | UUID | Filtrer på kategori (legacy) |
| `in_stream` | bool | `true` = ekskluder strøm-ekskluderte kategorier |
| `rating_min` / `rating_max` | int | Ratingintervall (1–5) |
| `taken_after` / `taken_before` | datetime | Tidsintervall |
| `deleted` | bool | `false` (standard) = aktive, `true` = slettede |
| `stacks_collapsed` | bool | `true` = vis kun stack-covers |
| `sort` | string | Se Sortering |
| `limit` | int | Standard 100, maks 10 000 |
| `offset` | int | Paginering |

## Sortering (`GET /photos`)

`taken_at_desc` (standard) / `taken_at_asc` / `registered_at_desc` / `registered_at_asc` / `rating_desc` / `rating_asc`. Photos uten verdi havner sist. Alle sorteringer bruker `registered_at_asc` som sekundær nøkkel for stabil paginering.

## Liste vs. detaljrespons

`GET /photos` returnerer `PhotoListItem` — kompakt, med `hotpreview_b64`, tid/posisjon (med accuracy), rating, kind/kategori/event/fotograf-ID-er, stack-felt, kamerafelt, `has_correction` + denormalisert `rotation`/`flip_horizontal` (for CSS-transform av thumbnails) og delingsstatus.

`GET /photos/{hothash}` returnerer `PhotoDetail` (arver alt over) og legger til `exif_data`, kildeflagg (`taken_at_source`, `location_source`), `input_session_id`, `registered_at`, `image_files`-listen og full `correction`.

---

## Agent-API (port 8002)

Agenten er et lokalt hjelpeprogram med filsystemtilgang — frontend kaller den direkte fra nettleseren (`src/api/agent.ts`). Ikke en del av backend-API-et.

| Prefiks | Innhold |
|---|---|
| `/health` | Liveness — frontend bruker denne til å vise/skjule agentavhengige funksjoner |
| `/browse` | Katalognavigasjon (`/volumes` + listing) |
| `/scan` | Skann katalog for bildegrupper |
| `/prescan` | Bakgrunnsjobb: skann + hash (`/start`, `/status/{job_id}`, `/files`) |
| `/process` | `/hash` (hotpreview → hothash), full prosessering (coldpreview + EXIF), `/exif`, `/preview` |
| `/copy` | Kopiering fra minnekort m.m. (`suggest-name`, opprett, status, `erase-source`) |
| `/files` | Lokale verktøy: `move`, `rotate`, `mkdir` (ADR-015/016) |
