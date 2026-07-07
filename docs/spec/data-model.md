# Datamodell

Speiler `backend/models/`. Ved avvik er modellene fasit — oppdater denne filen.

## Entiteter og relasjoner

```
Photographer ◄─┬─ photographer_id ── Photo ── kind_id ──────► Kind
 (access_level)│                       │  ── category_id ───► Category (legacy)
               │                       │  ── event_id ──────► Event ── parent_id ─► Event
               │                       │  ── stack_id ──────► Stack
               │                       │  ── input_session_id ► InputSession
               │                       │  ── registered_by_machine_id ► Machine
               │                       ├── (many) ImageFile
               │                       ├── (many) DuplicateFile
               │                       ├── (0..1) PhotoCorrection
               │                       ├── (many) PhotoFieldEdit
               │                       ├── (many) PhotoTag ──► Tag
               │                       └── (many) AiPhotoStatus
               │
               └─ Machine ── (many) MachineToken
                     ▲── enrolled_via_invite ── MachineInviteCode
                     └── (many) Shortcut

Collection ── (many) CollectionItem ──► Photo (via hothash)
                        └────────────► TextItem

InputSession ── (many) SessionError
FileCopyOperation ── (many) FileCopySkip, ── input_session_id ► InputSession
SavedSearch, SystemSettings, MachineLock   (frittstående)
```

---

## Photo

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | Intern database-ID |
| `hothash` | string (unique) | SHA256 av hotpreview — brukes som ID i API og filstier |
| `hotpreview_b64` | text | Base64-kodet 150×150 JPEG, generert fra masterfil |
| `taken_at` | datetime (nullable) | Effektivt tidspunkt — fra EXIF eller korrigert |
| `taken_at_source` | int | `0`=EXIF, `1`=justert fra EXIF, `2`=manuelt satt |
| `taken_at_accuracy` | string | `second` / `hour` / `day` / `month` / `year` |
| `taken_at_utc_offset` | string (nullable) | UTC-offset for tidspunktet (ADR-043) |
| `location_lat` / `location_lng` | float (nullable) | Effektiv posisjon — fra EXIF GPS eller korrigert |
| `location_source` | int (nullable) | Som `taken_at_source`; null hvis ingen posisjon |
| `location_accuracy` | string (nullable) | `exact` / `street` / `city` / `region` / `country` |
| `location_accuracy_meters` | float (nullable) | Numerisk presisjon (ADR-043) |
| `camera_make`, `camera_model`, `lens_model` | string (nullable) | Fra EXIF |
| `iso` | int (nullable) | Fra EXIF |
| `shutter_speed` | string (nullable) | Fra EXIF — f.eks. `"1/250"` |
| `aperture`, `focal_length` | float (nullable) | Fra EXIF |
| `kind_id` | UUID FK | Klassifikasjon (ADR-034) — aldri null, standard-kind ved registrering |
| `category_id` | UUID FK (nullable) | Legacy-kategori — null = ingen |
| `rating` | int (nullable) | 1–5 |
| `photographer_id` | UUID FK | Aldri null |
| `input_session_id` | UUID FK (nullable) | Registreringssesjon |
| `registered_by_machine_id` | UUID FK (nullable) | Maskinen som registrerte (ADR-011); null for eldre rader |
| `event_id` | UUID FK (nullable) | — |
| `stack_id` | UUID FK (nullable) | Stack-medlemskap — et Photo kan kun tilhøre én stack |
| `is_stack_cover` | bool | Alltid eksakt ett per stack |
| `width`, `height` | int (nullable) | Pikseldimensjoner (RAW: faktisk sensorstørrelse) |
| `dct_perceptual_hash`, `difference_hash` | bigint (nullable) | 64-bits perseptuelle hasher (ADR-004) |
| `sharpness_score`, `exposure_mean`, `exposure_clipping`, `noise_score` | float (nullable) | Kvalitetsmetrikker fra original ved registrering (ADR-021) |
| `is_shared` | bool | Delt internt (ADR-045) |
| `share_caption` | text (nullable) | Bildetekst på delingssiden |
| `share_downloads` | bool | Tillat nedlasting fra delingssiden |
| `share_views` | int | Visningsteller |
| `public_share_token` | text (unique, nullable) | Token for offentlig lenke via relay |
| `public_share_expires_at` | datetime (nullable) | Utløp for offentlig lenke |
| `registered_at` | datetime | — |
| `deleted_at` | datetime (nullable) | Null = aktiv. Satt = mykt slettet; hard-slettes via `empty-trash` |

Coldpreview har ingen egen kolonne — stien beregnes fra `hothash`: `<COLDPREVIEW_DIR>/<ab>/<cd>/<hothash>.jpg`.

## ImageFile

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `photo_id` | UUID FK (cascade) | Tilhørende Photo |
| `file_path` | string | Absolutt sti på klientmaskinen |
| `file_type` | string | `RAW`, `JPEG`, `TIFF`, `PNG`, `HEIC`, `XMP` |
| `is_master` | bool | Kildefil for hotpreview/EXIF (alltid false for XMP) |
| `file_size_bytes` | bigint (nullable) | Til filgjenkjenning ved flytting |
| `file_content_hash` | text (nullable) | SHA256 av råbytene — eksakt byte-identitet |
| `last_verified_at` | datetime (nullable) | Sist bekreftet på disk |
| `exif_data` | jsonb | Rå EXIF fra denne filen |
| `width`, `height` | int (nullable) | — |

## DuplicateFile

`id`, `photo_id` (FK cascade), `file_path` (unique), `session_id` (FK cascade), `detected_at`. Fil med kjent hothash men ukjent sti — samme bilde flere steder på disk.

## PhotoCorrection (ADR-028)

Én rad per Photo som har visningskorreksjoner (sparse). Appliseres på-farten i coldpreview-serveringen — ingen filer endres. Pipeline: rotation → flip_horizontal → horizon_angle → crop → exposure_ev.

| Felt | Type | Beskrivelse |
|---|---|---|
| `photo_id` | UUID PK/FK (cascade) | Én rad per Photo |
| `rotation` | int (nullable) | 90 / 180 / 270 |
| `flip_horizontal` | bool | Speilvend |
| `horizon_angle` | float (nullable) | ±15° |
| `exposure_ev` | float (nullable) | EV-justering |
| `crop_left/top/right/bottom` | float (nullable) | 0.0–1.0 per kant |
| `updated_at` | datetime | Brukes i ETag for cache-invalidering |

## PhotoFieldEdit (ADR-043)

Provenanslogg for metadata-endringer: `id`, `photo_id` (FK cascade), `field_name`, `old_value` (jsonb), `new_value` (jsonb), `edit_method`, `edit_details` (jsonb, nullable), `machine_id` (nullable), `edited_at`.

## InputSession

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | F.eks. "Kjells iPhone" |
| `source_path` | string | Katalogen som ble registrert (informasjonsfelt) |
| `recursive` | bool | Informasjonsfelt (standard true) |
| `default_photographer_id` | UUID FK | Aldri null |
| `default_event_id` | UUID FK (nullable) | — |
| `status` | string | `pending` → `uploading` → `completed` |
| `started_at` / `completed_at` | datetime | — |
| `photo_count`, `duplicate_count`, `error_count` | int | Løpende tellere |
| `notes` | text (nullable) | — |

## SessionError

`id`, `session_id` (FK cascade), `file_path`, `error`, `occurred_at`.

## Event

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | Ingen unik constraint |
| `description` | text (nullable) | — |
| `start_date` / `end_date` | date (nullable) | Datospenn; kan auto-settes fra photos |
| `location` | string (nullable) | — |
| `parent_id` | UUID FK (nullable) | Hierarki — maks ett nivå nesting |
| `cover_hothash` | string (nullable) | Null = første Photo etter `taken_at ASC` |
| `kind_id` | UUID FK | Eventens kind |
| `created_at` | datetime | — |

## Collection og CollectionItem

**Collection:** `id`, `name`, `description` (nullable), `cover_hothash` (nullable, fallback `position ASC`), `photographer_id` (nullable — eier/tilgang, ADR-044), `created_at`.

**CollectionItem:**

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | Stabil — endres ikke ved resortering |
| `collection_id` | UUID FK (cascade) | — |
| `hothash` | string (nullable) | Satt for foto-elementer |
| `text_item_id` | UUID FK (nullable) | Satt for tekstkort — nøyaktig ett av de to (CHECK) |
| `position` | int | Oppdateres samlet via PUT |
| `caption` | text (nullable) | Bildetekst |
| `notes` | text (nullable) | Forelesningsnotater — vises kun i presentasjonsmodus |

**TextItem:** `id`, `markup` (Markdown), `created_at`. Deles 1:N mellom CollectionItems.

## Stack

`id`, `created_at` + relasjon til Photos (via `photos.stack_id`). All øvrig informasjon ligger på Photo.

## Tag og PhotoTag (ADR-035)

**Tag:** `id`, `name`, `slug` (unique), `created_at`. Trigram-indeks på navn for likhetsøk.
**PhotoTag:** koblingstabell `photo_id` + `tag_id` (cascade begge veier).

## Kind (ADR-034)

`id`, `name`, `description` (nullable), `color` (nullable), `hidden_by_default`, `sort_order`, `is_default`, `created_at`. Hvert Photo og Event har nøyaktig én kind.

## Category (legacy)

`id`, `name` (unique), `excluded_from_stream`, `display_order`, `created_at`. Ikke lenger noe forvaltnings-API — Kind har overtatt. Beholdes for eksisterende data.

## Photographer

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | Visningsnavn og attribuering |
| `website`, `bio` | nullable | Offentlige (deling) |
| `notes` | text (nullable) | Intern — publiseres aldri |
| `is_default` | bool | Systemets primærfotograf |
| `is_unknown` | bool | Plassholderen «Ukjent fotograf» |
| `access_level` | string | `owner` / `guest` (ADR-044) |
| `created_at` | datetime | — |

## Machine, MachineToken, MachineInviteCode (ADR-011/040)

**Machine:**

| Felt | Type | Beskrivelse |
|---|---|---|
| `machine_id` | UUID PK | Genereres lokalt ved første oppstart (`DATA_DIR/machine_id`) — overlever DB-rekreasjon |
| `machine_name` | string | Brukerdefinert, f.eks. "Stue-PC" |
| `photographer_id` | UUID FK (nullable) | Maskinens fotograf (ADR-011) |
| `enrolled_via_invite` | UUID FK (nullable) | Invitasjonskoden som innrullerte maskinen |
| `role` | string | Legacy — erstattet av `photographers.access_level` (ADR-044) |
| `settings` | jsonb | Maskin-spesifikke innstillinger |
| `last_seen_at` | datetime (nullable) | — |
| `created_at` | datetime | — |

**MachineToken:** `id`, `machine_id` (FK cascade), `token_hash` (unique — klartekst lagres aldri), `created_at`, `last_used_at`, `is_active`, `label`.

**MachineInviteCode:** `id`, `code` (unique), `access_level` (nullable), `target_photographer_id` (nullable) eller `photographer_name` (opprettes ved innrullering), `expires_at`, `used_at`, `used_by_machine`, `created_at`. Engangskode.

## MachineLock (ADR-010)

`lock_type` (PK, f.eks. `registration`), `locked_by`, `locked_at`, `expires_at` (30 min TTL).

## SavedSearch (ADR-023)

`id`, `name`, `description` (nullable), `logic` (`AND`/`OR`), `criteria` (jsonb-liste), `created_at`, `updated_at`.

## AiPhotoStatus (ADR-022)

Analysestatus per Photo og capability: `photo_id` + `capability` (PK, `clip`/`faces`), `status` (`done`/`error`), `qdrant_id` (nullable), `face_count` (nullable), `analyzed_at`, `error`. Selve embeddingene ligger i Qdrant, ikke i PostgreSQL.

## FileCopyOperation og FileCopySkip (ADR-017)

**FileCopyOperation:** `id`, `source_path`, `destination_path`, `device_label` (nullable), `notes` (nullable), `status`, tellere (`files_total/copied/skipped`, `bytes_total/copied`), `verify_after_copy`, `include_videos`, `started_at`, `completed_at`, `error`, `input_session_id` (nullable — kobling til påfølgende registrering).

**FileCopySkip:** `id`, `operation_id` (FK cascade), `source_path`, `reason`, `skipped_at`.

## Shortcut

Katalogsnarveier per maskin (filutforskeren): `id`, `machine_id` (FK cascade), `name`, `path`, `position`, `is_default`, `created_at`.

## SystemSettings

Alltid eksakt én rad. Opprettes automatisk ved første oppstart.

| Felt | Type | Standard | Beskrivelse |
|---|---|---|---|
| `installation_id` | UUID PK | auto | Immutabel. Tilhører arkivet, ikke maskinen |
| `instance_name`, `owner_name` | string | `""` | Avsenderidentitet på installasjonsnivå |
| `owner_website`, `owner_bio` | nullable | — | — |
| `default_sort` | string | `taken_at_desc` | Standardsortering for `GET /photos` |
| `show_deleted_in_gallery` | bool | `false` | — |
| `browse_buffer_size` | int | `100` | Photos per batch ved progressiv lasting |
| `coldpreview_max_px` | int | `1200` | Påvirker ikke eksisterende coldpreviews |
| `coldpreview_quality` | int | `85` | — |
| `copy_verify_after_copy` | bool | `true` | SHA256-verifisering etter kopiering |
| `copy_include_videos` | bool | `false` | — |
| `public_share_relay_url` | text (nullable) | — | Relay-tjeneste for offentlig deling (ADR-045) |
| `public_share_base_url` | text (nullable) | — | Basen offentlige lenker bygges av |
| `public_share_api_key` | text (nullable) | — | — |
| `public_share_default_ttl_days` | int | `30` | Standard levetid for offentlige lenker |
| `extra` | jsonb | `{}` | Utvidbart |
