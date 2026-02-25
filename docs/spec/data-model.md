# Datamodell

## Entiteter og relasjoner

```
Photographer (1) ◄─── default ─── InputSession (1) ──── (many) Photo
                                                               │
Photographer (1) ◄──────────────────────── photographer_id ───┤
                                                               │
                                                    (many) ImageFile
                                                               │
Photo ──── Event (many-to-one, nullable)                       │
  │                                                    file_path, file_type,
  ├── Stack (via stack_id, self-grouped)                is_master
  │
  └── CollectionItem (many-to-many via Collection)
              │
         Collection
```

## Photographer

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | Visningsnavn |
| `notes` | text (nullable) | Valgfri merknad |
| `is_default` | bool | Systemets primærfotograf (eieren) |
| `is_unknown` | bool | Markerer plassholderen "Ukjent fotograf" |
| `created_at` | datetime | — |

## InputSession

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | Navn på kilde/sesjon, f.eks. "Kjells iPhone" |
| `source_path` | string | Katalog som ble registrert |
| `default_photographer_id` | UUID FK | Standardfotograf for denne sesjonen |
| `started_at` | datetime | Tidspunkt for registreringskjøring |
| `image_count` | int | Antall Photos registrert |

## Photo

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | Intern database-ID |
| `hothash` | string (unique) | SHA256 av hotpreview — brukes som ID i API og filstier |
| `hotpreview_b64` | text | Base64-kodet 150×150 JPEG, generert fra masterfil |
| `coldpreview_path` | string (nullable) | Sti til coldpreview-fil på disk |
| `exif_data` | jsonb | EXIF fra masterfil |
| `taken_at` | datetime (nullable) | Fra EXIF |
| `rating` | int (nullable) | 1–5 |
| `tags` | string[] | PostgreSQL ARRAY |
| `description` | text (nullable) | Fritekstbeskrivelse |
| `photographer_id` | UUID FK | Aldri null |
| `input_session_id` | UUID FK (nullable) | — |
| `event_id` | UUID FK (nullable) | — |
| `stack_id` | UUID (nullable) | — |
| `is_stack_cover` | bool | — |
| `registered_at` | datetime | — |

## ImageFile

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `photo_id` | UUID FK | Tilhørende Photo |
| `file_path` | string | Absolutt sti til filen |
| `file_type` | string | `RAW`, `JPEG`, `TIFF`, `PNG`, `HEIC`, `XMP` |
| `is_master` | bool | Kildefil for Photo sin hotpreview og EXIF (alltid false for XMP) |

## Event

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | Navn |
| `description` | text (nullable) | — |
| `date` | date (nullable) | — |
| `location` | string (nullable) | — |
| `parent_id` | UUID FK (nullable) | Hierarki — peker på overordnet event |
| `created_at` | datetime | — |

## Collection

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `name` | string | — |
| `description` | text (nullable) | — |
| `cover_hothash` | string (nullable) | Hothash til coverbilde |
| `created_at` | datetime | — |

## CollectionItem

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `collection_id` | UUID FK | — |
| `hothash` | string (nullable) | Null hvis tekstkort |
| `position` | int | Rekkefølge |
| `caption` | text (nullable) | Bildetekst |
| `is_text_card` | bool | Er dette et tekstkort (ikke bilde)? |
| `text_content` | text (nullable) | Innhold hvis tekstkort |
