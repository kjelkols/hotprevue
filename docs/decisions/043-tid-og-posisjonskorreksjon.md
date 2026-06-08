# ADR-043: Tid- og posisjonskorreksjon med provenans

**Status:** Planlagt  
**Dato:** 2026-06-08

---

## Kontekst

`Photo`-tabellen har allerede feltene `taken_at`, `taken_at_source`,
`taken_at_accuracy`, `location_lat`, `location_lng`, `location_source`
og `location_accuracy`. Det finnes også en `batch_taken_at`-funksjon i
`photo_service.py`.

Tre problemer gjør feltene utilstrekkelige i dag:

**Udokumenterte verdier.** `taken_at_source` er et heltall uten formell
definisjon — `1` er kommentert `# adjusted` i koden, men semantikken er
aldri spesifisert. `taken_at_accuracy` er en streng uten definert vokabular.
Det samme gjelder `location_source` — `1` er hardkodet som default i
schemas, uten at det er dokumentert hva verdiene betyr. Det finnes ingen
garanti for at klient og backend bruker samme verdier.

**Ingen provenans.** Når et tidsstempel korrigeres — f.eks. fordi
kameraklokken var feil — overskrives den opprinnelige verdien uten spor.
Det er ikke mulig å se hva tiden var før, hvem som endret den, eller
hvilken metode som ble brukt. XMP-standarden (`xmpMM:History`) løser
dette per fil; Hotprevue trenger et databaseekvivalent.

**Manglende felt.** Tidssone-offset fra EXIF mangler. Posisjons-nøyaktighet
er en udokumentert streng i stedet for et standard numerisk mål (meter).

**Sentrale brukstilfeller som ikke støttes:**
- To kameraer ble brukt på samme tur. Kamera B var 5 minutter og 20 sekunder
  foran. Alle bilder fra Kamera B skal justeres med −5:20 uten at original-
  tidsstempelet går tapt.
- Et skannet bilde har ingen EXIF-tid. Brukeren vet at det er fra sommeren
  1975 — dette skal beskrives med «måned»-presisjon, ikke et falskt eksakt
  tidsstempel.
- En bruker vil se hvilke bilder som har manuelt satte tider kontra EXIF-tider
  (søkbart via ADR-037).

---

## Beslutning

### 1. Formell kildeverdi-enum for `taken_at_source`

Erstatter de udokumenterte heltallene med en definert tabell. Verdiene er
kompatible med EXIF-standarden og IPTC-praksis.

| Verdi | Konstant | Kilde |
|-------|----------|-------|
| `0` | `unknown` | Ingen tidsinformasjon funnet |
| `1` | `exif_original` | EXIF DateTimeOriginal (kameraklokke) |
| `2` | `exif_gps` | EXIF GPS-tidsstempel (UTC, synkronisert) |
| `3` | `exif_digitized` | EXIF DateTimeDigitized (scanning) |
| `4` | `filesystem` | Filsystem-mtime (fallback, upålitelig) |
| `5` | `manual` | Manuelt angitt av bruker |
| `6` | `offset_corrected` | Justert fra EXIF ved offset |
| `7` | `estimated` | Estimert fra kontekst |
| `8` | `gps_synced` | Synkronisert mot GPS-spor (GPX) |

Defineres som konstanter i `backend/utils/time_source.py` og
`frontend/src/lib/timeSource.ts`.

**Migrering av eksisterende `taken_at_source`-data:**
Eksisterende verdier i databasen (`0`, `1`, `2`) mappes:
- `0` → `0` (unknown, uendret)
- `1` → `6` (offset_corrected — dette er hva `# adjusted` betyr)
- `2` → `5` (manual — dette er hva BatchTakenAt-default betyr)

### 2. Formell kildeverdi-enum for `location_source`

Parallell struktur til `taken_at_source`. Verdiene er kompatible med EXIF
GPS-standarden og W3C Geolocation API.

| Verdi | Konstant | Kilde |
|-------|----------|-------|
| `0` | `unknown` | Ingen posisjonsinformasjon |
| `1` | `exif_gps` | EXIF GPS-data fra kamera eller telefon |
| `2` | `manual` | Manuelt plassert på kart (LocationEditorPage) |
| `3` | `estimated` | Estimert fra kontekst (nærliggende bilder, event) |
| `4` | `gpx_track` | Matchet mot GPS-spor (GPX-fil) |
| `5` | `batch_assigned` | Batch-tildelt fra et annet bilde eller event |

Defineres i `backend/utils/location_source.py` og
`frontend/src/lib/locationSource.ts`.

**Migrering av eksisterende `location_source`-data:**
Eksisterende verdi `1` (EXIF GPS, default i schema) er korrekt — ingen
endring. `NULL`-verdier settes til `0` (unknown).

### 4. Formell nøyaktighetsverdier for `taken_at_accuracy`

Basert på Darwin Core og Dublin Core-praksis for historiske arkiver:

| Verdi | Betyr | Visningseksempel |
|-------|-------|-----------------|
| `subsecond` | Sub-sekund (EXIF SubSecTime) | 14:32:07.342 |
| `second` | Eksakt sekund | 14:32:07 |
| `minute` | Eksakt minutt | 14:32 |
| `hour` | Eksakt time | ca. kl. 14 |
| `day` | Eksakt dato | 3. juni 2024 |
| `month` | Måned kjent, dag usikker | juni 2024 |
| `year` | År kjent, måned usikker | 2024 |
| `decade` | Omtrentlig tiår | 1980-tallet |
| `unknown` | Ingen tidsinformasjon | — |

For skannet bilde fra sommeren 1975:
- `taken_at = 1975-07-01T00:00:00Z` (midtpunkt som beste estimat)
- `taken_at_accuracy = 'month'`
- Vises som «ca. juli 1975»

For bilde der kun årstall er kjent:
- `taken_at = 1985-07-01T00:00:00Z`
- `taken_at_accuracy = 'year'`
- Vises som «ca. 1985»

### 5. To nye kolonner på `photos`

```sql
ALTER TABLE photos
    ADD COLUMN taken_at_utc_offset TEXT NULL,
    ADD COLUMN location_accuracy_meters FLOAT NULL;
```

**`taken_at_utc_offset`** — tidssone-offset som streng (`"+02:00"`,
`"-05:00"`, `"Z"`). `NULL` betyr ukjent tidssone. Settes fra EXIF
`OffsetTimeOriginal` om tilgjengelig, ellers `NULL`. Kan settes manuelt.

Lagret separat fra `taken_at` (som alltid er UTC) slik at vi bevarer
skillet mellom «hva kameraet visste» og «hva vi har konvertert til».

**`location_accuracy_meters`** — horisontal nøyaktighet i meter,
konsistent med EXIF `GPSHPositioningError` og W3C Geolocation API.
Eksempler: `5.0` (GPS-chip), `100.0` (manuelt plassert på gate-nivå),
`10000.0` (satt til by-nivå), `NULL` (ukjent).

Eksisterende `location_accuracy` (streng) beholdes for
bakoverkompatibilitet men depreceres — ny kode bruker
`location_accuracy_meters`.

### 6. Provenans-tabell: `photo_field_edits`

```
photo_field_edits
────────────────────────────────────────────────────────
id              UUID          PK
photo_id        UUID          FK → photos.id  ON DELETE CASCADE
field_name      TEXT          NOT NULL   ('taken_at', 'location')
old_value       JSONB         NOT NULL   snapshot før endring
new_value       JSONB         NOT NULL   snapshot etter endring
edit_method     TEXT          NOT NULL   se tabell under
edit_details    JSONB         NULL       metode-spesifikk info
machine_id      UUID          NULL  FK → machines.machine_id
edited_at       TIMESTAMPTZ   NOT NULL   DEFAULT now()
```

`field_name` er enten `'taken_at'` eller `'location'` — ikke per-kolonne,
men per domenekonsept. En enkelt redigering av tid lagrer ett snapshot
som dekker alle tidsrelaterte felt.

`old_value` / `new_value` — JSONB-snapshot av alle relevante felt.

For `field_name = 'taken_at'`:
```json
{
  "taken_at": "2024-06-01T10:00:00Z",
  "taken_at_source": 1,
  "taken_at_accuracy": "second",
  "taken_at_utc_offset": null
}
```

For `field_name = 'location'`:
```json
{
  "location_lat": 60.394,
  "location_lng": 5.326,
  "location_source": 1,
  "location_accuracy_meters": 5.0
}
```

`edit_method`-verdier:

| Verdi | Scenario |
|-------|---------|
| `manual` | Bruker satte tid/posisjon direkte i UI |
| `batch_offset` | Kamera-klokke-korreksjon: offset i sekunder |
| `gps_sync` | Tid synkronisert mot GPX-spor |
| `location_editor` | Posisjon satt fra `LocationEditorPage` |
| `exif_reread` | EXIF lest på nytt, overskrev eksisterende |

`edit_details` for `batch_offset`:

```json
{
  "offset_seconds": -320,
  "note": "Kamera B var 5 min 20 sek foran Kamera A",
  "reference_hothash": "abc123..."
}
```

Indeks for oppslag:

```sql
CREATE INDEX ix_photo_field_edits_photo_id
    ON photo_field_edits (photo_id, edited_at DESC);
```

### 7. Batch-offset API

```
PATCH /photos/batch-time-offset
Content-Type: application/json

{
  "hothashes": ["abc...", "def...", ...],
  "offset_seconds": -320,
  "note": "Kamera B synkronisert mot Kamera A"
}
```

Flyten per bilde:

1. Les eksisterende `taken_at`, `taken_at_source`, `taken_at_accuracy`,
   `taken_at_utc_offset` → lagre som `old_value` i `photo_field_edits`
2. Beregn `new_taken_at = taken_at + timedelta(seconds=offset_seconds)`
3. Oppdater `taken_at = new_taken_at`
4. Oppdater `taken_at_source = 6` (offset_corrected)
5. `taken_at_accuracy` og `taken_at_utc_offset` uendret
6. Lagre `new_value` i `photo_field_edits`

Offset er alltid en relativ korreksjon — den endrer ikke tidssone.

**Offset-beregning i UI:** Bruker velger ett bilde fra Kamera A og ett
fra Kamera B av samme motiv → frontend beregner
`offset = kamera_a.taken_at − kamera_b.taken_at` og foreslår dette som
offset for alle bilder fra Kamera B i samme sesjon.

### 8. Utvidelse av batch-location API

Eksisterende `batch_location`-funksjon utvides til å skrive provenans:

```
PATCH /photos/batch-location
{
  "hothashes": [...],
  "location_lat": 60.394,
  "location_lng": 5.326,
  "location_source": 5,
  "location_accuracy_meters": 100.0
}
```

Provenance-rad skrives med `edit_method = 'location_editor'`.

### 9. Søkefelt (tillegg til ADR-037)

Disse feltene legges til søkemotoren som en naturlig utvidelse av ADR-037:

| Felt | Operatorer | Brukstilfelle |
|------|-----------|---------------|
| `taken_at_source` | `eq`, `any_of` | Finn alle manuelt tidssatte bilder |
| `taken_at_accuracy` | `eq`, `any_of` | Finn alle bilder med usikker dato |
| `location_source` | `eq`, `any_of` | Finn bilder med GPS-posisjon vs. manuelt satt |
| `location_accuracy_meters` | `lte`, `gte` | Finn bilder med nøyaktig GPS (f.eks. < 20 m) |
| `has_location` | `eq` | (Allerede i ADR-037) |

---

## Hva som ikke endres

- `taken_at` forblir en enkelt `DateTime(timezone=True)` kolonne — ingen
  datointervallfelt. «Beste estimat» kombinert med `taken_at_accuracy`
  dekker alle praktiske tilfeller.
- Eksisterende `batch_taken_at`-endepunkt beholdes men skrives om
  internt til å bruke provenans.
- EXIF-uttrekkingen i `utils/exif.py` er uendret — kildeverdi-mappingen
  skjer i `input_session_service.py`.

---

## Begrunnelse

**Enum-verdier over magic numbers:** `taken_at_source = 1` betyr
ingenting uten en kommentar. Navngitte konstanter er lesbare i kode,
søkbare i databasen, og kan vises som tekst i UI uten en hardkodet
if-kjede.

**Provenans i database, ikke XMP:** XMP `xmpMM:History` er standard
per fil, men Hotprevue-backenden leser aldri originalfiler. En
databasetabell gir den samme sporingsevnen uten å kreve skriving til
originalene.

**Snapshot over diff:** `old_value` og `new_value` lagrer et komplett
snapshot av alle relevante felt, ikke bare det som endret seg. Det gjør
det mulig å rekonstruere tilstanden uten å kjøre alle edits i rekkefølge.

**Meter som nøyaktighet:** EXIF, W3C Geolocation, og alle moderne GPS-API-er
bruker meter. En streng som `"city"` er ikke interoperabel med noe annet
system; et tall i meter er det.

**`taken_at_utc_offset` separat fra `taken_at`:** `taken_at` er UTC —
det er entydig og søkbart. Offset-strengen er kontekstuell informasjon
om hva kameraet visste. De to tingene har ulik semantikk og bør ikke
blandes.

---

## Implementeringsplan

| Steg | Fil | Innhold |
|------|-----|---------|
| 1 | `backend/utils/time_source.py` | Konstanter for `taken_at_source` og `taken_at_accuracy` |
| 2 | `backend/utils/location_source.py` | Konstanter for `location_source` |
| 3 | `frontend/src/lib/timeSource.ts` | `taken_at_source` og `taken_at_accuracy` + display-strenger |
| 4 | `frontend/src/lib/locationSource.ts` | `location_source` + display-strenger |
| 5 | `backend/alembic/versions/…_time_provenance.py` | `taken_at_utc_offset`, `location_accuracy_meters`, `photo_field_edits`-tabell, datamigrasjon av source-verdier |
| 6 | `backend/models/photo.py` | `taken_at_utc_offset`, `location_accuracy_meters` |
| 7 | `backend/models/photo_field_edit.py` | `PhotoFieldEdit`-modell |
| 8 | `backend/services/photo_service.py` | Omskriv `batch_taken_at` + `batch_location` til å skrive provenans |
| 9 | `backend/api/photos.py` | `PATCH /photos/batch-time-offset` (nytt endepunkt) |
| 10 | `backend/services/search_service.py` | Søkefelt: `taken_at_source`, `taken_at_accuracy`, `location_source`, `location_accuracy_meters` (tillegg til ADR-037) |
| 11 | `frontend/src/features/photos/PhotoMetaPanel.tsx` | Vis kilde og nøyaktighet som lesbare merkelapper for både tid og posisjon |
| 12 | `frontend/src/features/photos/TimeOffsetTool.tsx` | Kamera-synkroniseringsverktøy (velg to bilder → beregn offset → appliser på utvalg) |
| 13 | `frontend/src/features/photos/PhotoFieldHistory.tsx` | Vis provenans-historikk per bilde (tid og posisjon) |
| 14 | `backend/tests/api/test_time_correction.py` | Batch-offset, provenans-skriving, rollback-mulighet |

---

## Konsekvenser

**Gevinst:** Alle tidsendringer er sporbare. Kamera-synkronisering er en
førsteklasses operasjon med tilstrekkelig metadata til å forstå og eventuelt
reversere den. Skannet historisk materiale kan beskrives presist uten
falskt eksakte tidsstempler. Søk på tidskilde og nøyaktighet muliggjøres
(ADR-037-utvidelse).

**Kostnad:** Provenans-tabellen vokser ved alle tidsredigeringer. For et
arkiv med mye manuell redigering kan dette bli en stor tabell — indeksen
på `(photo_id, edited_at DESC)` gjør oppslag raskt. Gammel data har
ingen provenans — det er en akseptert begrensning.

**Ikke i scope:**
- GPX-spor-import for automatisk tids- og posisjonssynkronisering
  (naturlig neste steg, bygger på `gps_synced`-kildeverdien)
- Automatisk reversering av en offset-korreksjon via provenans
  (dataene er til stede, men inget API for det ennå)
- Tidssone-database for automatisk utledning av offset fra GPS-koordinat
  og tid
- EXIF-skriving av korrigert tid tilbake til originalfil (se ADR-020)
