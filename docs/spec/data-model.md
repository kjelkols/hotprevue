# Datamodell

## Entiteter og relasjoner

```
                    ┌─ default_photographer_id ──► Photographer ◄── photographer_id ─┐
                    │                                                                  │
InputSession ───────┤─ default_event_id ─────────► Event ◄──── event_id ─────────────┤
                    │                                                                  │
                    ├──── (many) Photo ─────────────────────────────────────────────── ┘
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
| `coldpreview_path` | string (nullable) | Sti til coldpreview-fil på disk |
| `exif_data` | jsonb | Rå EXIF fra masterfil — referanse og kilde for reset |
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
| `rating` | int (nullable) | 1–5 |
| `description` | text (nullable) | Fritekstbeskrivelse |
| `photographer_id` | UUID FK | Aldri null |
| `input_session_id` | UUID FK (nullable) | Null for historiske photos uten sesjonskontekst |
| `event_id` | UUID FK (nullable) | — |
| `stack_id` | UUID (nullable) | Grupperings-ID — Photos med samme `stack_id` tilhører én stack. Et Photo kan kun tilhøre én stack. |
| `is_stack_cover` | bool | Om dette Photo er coverbilde for stacken. Alltid eksakt ett per stack. |
| `registered_at` | datetime | — |
| `deleted_at` | datetime (nullable) | Null = aktiv. Satt = mykt slettet. Hard-slettes via `empty-trash`. |

---

## ImageFile

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `photo_id` | UUID FK | Tilhørende Photo |
| `file_path` | string | Absolutt sti til filen |
| `file_type` | string | `RAW`, `JPEG`, `TIFF`, `PNG`, `HEIC`, `XMP` |
| `is_master` | bool | Kildefil for Photo sin hotpreview og EXIF (alltid false for XMP) |

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
