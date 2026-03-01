# Datamodell

## Entiteter og relasjoner

```
                    ┌─ default_photographer_id ──► Photographer ◄── photographer_id ─┐
                    │                                                                  │
InputSession ───────┤─ default_event_id ─────────► Event ◄──── event_id ─────────────┤
                    │                                                                  │
                    ├──── (many) Photo ──── category_id ──► Category
                    │           │                                                         ┘
                    │           │
                    │           ├── (many) ImageFile
                    │           ├── Stack (self-grouped via stack_id)
                    │           └── CollectionItem ──► Collection
                    │
                    ├──── (many) SessionError
                    │
                    └──── (many) DuplicateFile ──► Photo (eksisterende duplikat)
```

---

## Photographer

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | Visningsnavn og copyright-attributering |
| `website` | string (nullable) | Portefølje eller personlig side |
| `bio` | text (nullable) | Kort presentasjon — brukes i Global-profil |
| `notes` | text (nullable) | Intern merknad — publiseres aldri |
| `is_default` | bool | Systemets primærfotograf (eieren) |
| `is_unknown` | bool | Markerer plassholderen "Ukjent fotograf" |
| `created_at` | datetime | — |

---

## InputSession

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | Navn på kilde/sesjon, f.eks. "Kjells iPhone" |
| `source_path` | string | Katalog som ble registrert |
| `recursive` | bool | Skann underkataloger? (standard: true) |
| `default_photographer_id` | UUID FK | Standardfotograf — aldri null |
| `default_event_id` | UUID FK (nullable) | Standardevent — null betyr ingen event |
| `status` | string | `pending` / `scanning` / `awaiting_confirmation` / `processing` / `completed` / `failed` |
| `started_at` | datetime | Tidspunkt for opprettelse |
| `completed_at` | datetime (nullable) | Tidspunkt for fullføring |
| `photo_count` | int | Antall Photos registrert (oppdateres ved fullføring) |
| `duplicate_count` | int | Antall duplikater funnet (oppdateres ved fullføring) |
| `error_count` | int | Antall filer som feilet (oppdateres ved fullføring) |

---

## Photo

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | Intern database-ID |
| `hothash` | string (unique) | SHA256 av hotpreview — brukes som ID i API og filstier |
| `hotpreview_b64` | text | Base64-kodet 150×150 JPEG, generert fra masterfil |
| `taken_at` | datetime (nullable) | Effektivt tidspunkt — fra EXIF eller korrigert |
| `taken_at_source` | int | `0`=EXIF, `1`=Justert fra EXIF, `2`=Manuelt satt |
| `taken_at_accuracy` | string | `second` / `hour` / `day` / `month` / `year` |
| `location_lat` | float (nullable) | Effektiv breddegrad — fra EXIF GPS eller korrigert |
| `location_lng` | float (nullable) | Effektiv lengdegrad — fra EXIF GPS eller korrigert |
| `location_source` | int (nullable) | `0`=EXIF, `1`=Justert fra EXIF, `2`=Manuelt satt. Null hvis ingen posisjon. |
| `location_accuracy` | string (nullable) | `exact` / `street` / `city` / `region` / `country`. Null hvis ingen posisjon. |
| `camera_make` | string (nullable) | Fra EXIF — f.eks. `"Canon"` |
| `camera_model` | string (nullable) | Fra EXIF — f.eks. `"EOS R5"` |
| `lens_model` | string (nullable) | Fra EXIF |
| `iso` | int (nullable) | Fra EXIF |
| `shutter_speed` | string (nullable) | Fra EXIF — f.eks. `"1/250"` |
| `aperture` | float (nullable) | Fra EXIF — f-tall, f.eks. `2.8` |
| `focal_length` | float (nullable) | Fra EXIF — i mm |
| `width` | int (nullable) | Faktisk sensorbredde i piksler (fra RAW) eller bildebredde |
| `height` | int (nullable) | Faktisk sensorhøyde i piksler (fra RAW) eller bildehøyde |
| `dct_perceptual_hash` | bigint (nullable) | DCT-basert perceptual hash (pHash) — 64 bit. Se `docs/decisions/004-perceptual-hash.md`. |
| `difference_hash` | bigint (nullable) | Difference hash (dHash) — 64 bit. Se `docs/decisions/004-perceptual-hash.md`. |
| `tags` | TEXT[] | Fritekstetiketter. GIN-indeksert. Normalisert til lowercase ved skriving. |
| `category_id` | UUID FK (nullable) | Brukerdefinert kategori. Null = ingen kategori, alltid i strømmen. |
| `rating` | int (nullable) | 1–5 |
| `photographer_id` | UUID FK | Aldri null |
| `input_session_id` | UUID FK (nullable) | Null for historiske photos uten sesjonskontekst |
| `event_id` | UUID FK (nullable) | — |
| `stack_id` | UUID (nullable) | Grupperings-ID — Photos med samme `stack_id` tilhører én stack. Et Photo kan kun tilhøre én stack. |
| `is_stack_cover` | bool | Om dette Photo er coverbilde for stacken. Alltid eksakt ett per stack. |
| `registered_at` | datetime | — |
| `deleted_at` | datetime (nullable) | Null = aktiv. Satt = mykt slettet. Hard-slettes via `empty-trash`. |

Coldpreview har ingen egen kolonne — stien beregnes fra `hothash` ved behov: `<COLDPREVIEW_DIR>/<ab>/<cd>/<hothash>.jpg`.

---

## ImageFile

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `photo_id` | UUID FK | Tilhørende Photo |
| `file_path` | string | Absolutt sti til filen |
| `file_type` | string | `RAW`, `JPEG`, `TIFF`, `PNG`, `HEIC`, `XMP` |
| `is_master` | bool | Kildefil for Photo sin hotpreview og EXIF (alltid false for XMP) |
| `file_size_bytes` | bigint (nullable) | Filstørrelse ved registrering — brukes til filgjenkjenning ved filforflytting |
| `file_content_hash` | text (nullable) | SHA256 hex av råbytene — eksakt byte-identitet, uavhengig av visuell prosessering |
| `last_verified_at` | datetime (nullable) | Sist bekreftet tilgjengelig på disk |
| `exif_data` | jsonb | Rå EXIF fra denne spesifikke filen — hvert ImageFile har egne data |
| `width` | int (nullable) | Bildebredde i piksler |
| `height` | int (nullable) | Bildehøyde i piksler |

RAW-master: `width`/`height` er faktisk sensorstørrelse (fra LibRaw), ikke innebygd JPEG-thumbnail.

---

## DuplicateFile

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `photo_id` | UUID FK (cascade delete) | Photo denne filen er duplikat av |
| `file_path` | string (unique) | Absolutt sti til duplikatfilen |
| `session_id` | UUID FK | Sesjonen som oppdaget duplikatet |
| `detected_at` | datetime | — |

---

## SessionError

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `session_id` | UUID FK (cascade delete) | Tilhørende sesjon |
| `file_path` | string | Filen som feilet |
| `error` | string | Feilmelding fra systemet |
| `occurred_at` | datetime | — |

---

## Event

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | Navn |
| `description` | text (nullable) | — |
| `date` | date (nullable) | — |
| `location` | string (nullable) | — |
| `parent_id` | UUID FK (nullable) | Hierarki — peker på overordnet event. Maks ett nivå: en child-event kan ikke selv ha children. |
| `cover_hothash` | string (nullable) | Eksplisitt coverbilde. Null = bruk første Photo etter `taken_at ASC`. |
| `created_at` | datetime | — |

---

## Collection

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | — |
| `description` | text (nullable) | — |
| `cover_hothash` | string (nullable) | Eksplisitt coverbilde. Null = bruk første CollectionItem etter `position ASC`. |
| `created_at` | datetime | — |

---

## CollectionItem

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `collection_id` | UUID FK | — |
| `hothash` | string (nullable) | Null hvis tekstkort |
| `position` | int | Rekkefølge. Ingen unik constraint — oppdateres samlet via PUT. |
| `caption` | text (nullable) | Bildetekst for photo-items |
| `is_text_card` | bool | Er dette et tekstkort (ikke bilde)? |
| `title` | text (nullable) | Tittel for tekstkort |
| `text_content` | text (nullable) | Innhold for tekstkort |

---

## PhotoCorrection

Én rad per Photo som har visningskorreksjoner. Tabellen er sparse — kun Photos med aktive korreksjoner har en rad.

| Felt | Type | Beskrivelse |
|---|---|---|
| `photo_id` | UUID FK (unique) | Tilhørende Photo — én rad per Photo |
| `rotation` | int (nullable) | `0`, `90`, `180`, `270` grader |
| `horizon_angle` | float (nullable) | Grader å rette opp (±15°) |
| `exposure_ev` | float (nullable) | EV-justering, f.eks. `+0.5`, `-1.0` |
| `crop_left` | float (nullable) | 0.0–1.0 — andel av bredde fra venstre |
| `crop_top` | float (nullable) | 0.0–1.0 — andel av høyde fra topp |
| `crop_right` | float (nullable) | 0.0–1.0 — andel av bredde fra høyre |
| `crop_bottom` | float (nullable) | 0.0–1.0 — andel av høyde fra bunn |
| `corrected_coldpreview_path` | string (nullable) | Sti til korrigert coldpreview-fil. Null mens generering pågår. |
| `updated_at` | datetime | — |

---

## Category

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string (unique) | Visningsnavn — f.eks. `"Botanikk"` |
| `excluded_from_stream` | bool | Ekskluderes fra standard gallerivisning |
| `display_order` | int | Rekkefølge i dropdown |
| `created_at` | datetime | — |

---

## SystemSettings

Alltid eksakt én rad. Opprettes automatisk ved første oppstart med standardverdier og generert `installation_id`.

| Felt | Type | Standard | Beskrivelse |
|---|---|---|---|
| `installation_id` | UUID | auto-generert | Immutabelt. Genereres ved første oppstart. Unik identifikator for denne installasjonen — brukes mot Hotprevue Global. |
| `instance_name` | string | `""` | Visningsnavn for installasjonen, f.eks. `"Kjells fotoarkiv"`. Publiseres til Global. |
| `owner_name` | string | `""` | Navn på eier/administrator. Publiseres til Global. |
| `owner_website` | string (nullable) | `null` | Nettside for eier. Publiseres til Global. |
| `owner_bio` | text (nullable) | `null` | Kort presentasjon av eier. Publiseres til Global. |
| `default_sort` | string | `taken_at_desc` | Standardsortering for `GET /photos`. Gyldige verdier: se Sortering i api.md. |
| `show_deleted_in_gallery` | bool | `false` | Vis mykt slettede Photos i BrowseView med slettet-indikator. |
| `browse_buffer_size` | int | `100` | Antall photos per batch ved progressiv lasting i BrowseView. |
| `coldpreview_max_px` | int | `1200` | Maks langside i piksler ved generering av coldpreview ved registrering. Påvirker ikke eksisterende coldpreviews. |
| `coldpreview_quality` | int | `85` | JPEG-kvalitet for coldpreview ved registrering (1–100). Påvirker ikke eksisterende coldpreviews. Anbefalt: 85. |
| `copy_verify_after_copy` | bool | `true` | SHA256-verifisering av hver fil etter kopiering. |
| `copy_include_videos` | bool | `false` | Inkluder videofiler ved filkopiering. |

---

## Machine

Én rad per maskin som har brukt databasen. Identifikatoren (`machine_id`) genereres lokalt ved første oppstart og lagres i `DATA_DIR/machine_id`.

| Felt | Type | Standard | Beskrivelse |
|---|---|---|---|
| `machine_id` | UUID PK | lokalt generert | Immutabelt. Unik per maskin, overlever DB-rekreasjon. |
| `machine_name` | string | `""` | Brukerdefinert navn, f.eks. `"Stue-PC"`. |
| `settings` | JSONB | `{}` | Utvidbar JSONB for maskin-spesifikke innstillinger, f.eks. `default_photographer_id`. |
| `last_seen_at` | datetime (nullable) | `null` | Oppdateres ved hver oppstart. |
| `created_at` | datetime | auto | — |

---

## Shortcut

Navngitte katalogsnarveier for en spesifikk maskin. Vises i filutforskeren (FileBrowser) og brukes som startpunkt. Seedes automatisk med «Hjemmeområde» ved nyinstallasjon.

| Felt | Type | Standard | Beskrivelse |
|---|---|---|---|
| `id` | UUID PK | auto | — |
| `machine_id` | UUID FK → machines | — | Snarveien tilhører én maskin. Slettes cascade. |
| `name` | string | — | Visningsnavn, f.eks. `"Bilder"`. |
| `path` | string | — | Absolutt filsti, f.eks. `/home/kjell/Bilder`. |
| `position` | int | `0` | Sorteringsrekkefølge innen maskinen. |
| `created_at` | datetime | auto | — |
