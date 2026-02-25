# Datamodell

## Entiteter og relasjoner

```
Photographer (1) ◄─── default ─── InputSession (1) ──── (many) Image
                                                               │
Photographer (1) ◄─────────────────────────────────── photographer_id
                                                               │
Image ──── Event (many-to-one, nullable)                       │
  │                                                            │
  ├── Stack (via stack_id, self-grouped)                       │
  │                                                            │
  ├── CompanionFile (one-to-many)                              │
  │                                                            │
  └── CollectionItem (many-to-many via Collection)             │
              │                                                │
         Collection                                            │
                                                               │
InputSession (1) ◄──────────────────────── input_session_id ──┘
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
| `image_count` | int | Antall bilder registrert |

## Image

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | Intern database-ID |
| `hothash` | string (unique) | SHA256 av hotpreview — brukes som ID i API og filstier |
| `file_path` | string | Absolutt sti til originalfil |
| `hotpreview_b64` | text | Base64-kodet 150×150 JPEG |
| `coldpreview_path` | string (nullable) | Sti til coldpreview-fil på disk |
| `taken_at` | datetime (nullable) | Tidspunkt fra EXIF |
| `rating` | int (nullable) | 1–5 |
| `tags` | string[] | PostgreSQL ARRAY |
| `description` | text (nullable) | Fritekstbeskrivelse |
| `exif_data` | jsonb | Rå EXIF-data |
| `photographer_id` | UUID FK | Fotografen som tok bildet (aldri null) |
| `input_session_id` | UUID FK (nullable) | Hvilken sesjon bildet ble registrert i |
| `event_id` | UUID FK (nullable) | Tilknyttet event |
| `stack_id` | UUID (nullable) | Stack-gruppering |
| `is_stack_cover` | bool | Er dette stackens coverbilde? |
| `registered_at` | datetime | Tidspunkt for registrering |

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

## CompanionFile

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `hothash` | string (FK) | Tilknyttet bilde |
| `file_type` | string | RAW, JPEG, XMP, etc. |
| `file_path` | string | Absolutt sti |
