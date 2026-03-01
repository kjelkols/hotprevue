# Filkopiering — strategi og spesifikasjon

## Formål

Støtte for å kopiere bildefiler fra en kilde (minnekort, USB, nettverksstasjon) til en
destinasjonskatalog **før** registrering. Trinnet er frivillig og presenteres som en
utvidbar seksjon i registreringsdialogen.

Hotprevue bestemmer aldri filstruktur eller lagringssted — det er alltid brukerens valg.
Hotprevue tilbyr kun kopieringsoperasjonen som en tjeneste og lagrer metadata om den.

---

## Brukeropplevelse

### Plassering i registreringsflyten

```
Steg 1 — Oppsett (fotograf, sesjonsnavn, notater)
  ↳ [☐ Kopier filer fra minnekort eller annen kilde]   ← avkrysningsboks
      Utvides til kopieringsseksjonen når avkrysset

Steg 2 — Velg katalog å skanne
  (Pre-fylles med destinasjonskatalog hvis kopiering ble utført)

Steg 3 — Skanning og registrering
```

Avkrysningsboksen er uavkrysset som standard. Brukere som registrerer fra en lokal
katalog ser ikke kopieringsseksjonen med mindre de aktivt velger det.

### Kopieringsseksjonen (utvidet visning)

```
┌────────────────────────────────────────────────────────────────┐
│ ☑ Kopier filer fra minnekort eller annen kilde                 │
│                                                                │
│  Kilde                                                         │
│  [/Volumes/EOS_DIGITAL/DCIM          ] [Velg…]                │
│                                                                │
│  Destinasjon                                                   │
│  Overmappe: [/bilder/                ] [Velg…]                │
│  Navn:      [2026-03-01              ]                         │
│             ↑ forslag basert på første bilde — trykk Tab       │
│             for å akseptere, fortsett å skrive for å legge til │
│             f.eks. «2026-03-01 Sydentur»                       │
│                                                                │
│  Enhetsnavn (valgfritt): [Sony A7IV kort 1        ]            │
│                                                                │
│  156 bildefiler funnet  ·  4,2 GB                              │
│                                                                │
│                          [Kopier filer →]                      │
└────────────────────────────────────────────────────────────────┘
```

Under kopiering:
```
  ████████████░░░░░  78 av 156 filer  (3,1 GB av 4,2 GB)
  [Avbryt]
```

Etter fullføring:
```
  ✓ 154 filer kopiert  ·  2 hoppet over (fantes allerede)
  [Vis hoppede over]   [Fortsett til skanning →]
```

### Navneforslag og Tab-mønster

Når kilden er valgt, henter backend tidspunktet for det tidligste bildet (rask EXIF-skanning
uten full bildedekoding). Forslaget vises som grå plassholdertekst i navnefeltet:

- Feltet er tomt, plassholder vises: `2026-03-01`
- Bruker trykker **Tab**: plassholderteksten fylles inn som faktisk verdi, cursor plasseres
  etter siste tegn
- Bruker skriver videre: `2026-03-01 Sydentur`
- Bruker ignorerer forslaget og skriver selv: plassholder forsvinner på første tegn

Fullstendig destinasjonssti = `overmappe / navn`, f.eks. `/bilder/2026-03-01 Sydentur/`.
Katalogen opprettes av hotprevue hvis den ikke finnes.

---

## Innstillinger

To nye felt på `SystemSettings`:

| Felt | Type | Standard | Beskrivelse |
|---|---|---|---|
| `copy_verify_after_copy` | bool | `true` | SHA256-verifisering av hver fil etter kopi |
| `copy_include_videos` | bool | `false` | Inkluder videofiler i kopieringen |

Begge vises på innstillingssiden under en ny seksjon «Filkopiering».

Verdiene ved operasjonsstart snapshottes inn i `file_copy_operations`-tabellen slik at
historikk gjenspeiler hva som faktisk ble brukt — uavhengig av senere innstillingsendringer.

### Verifisering

Når `copy_verify_after_copy = true`: SHA256 av kildefil og kopiert fil sammenlignes.
Ved mismatch markeres filen som `hash_mismatch` i `file_copy_skips` og kopien slettes.
Verifisering er anbefalt standard siden minnekort kan gi lesekorrupsjon.

### Videofiler

Når `copy_include_videos = false` (standard) kopieres kun kjente bildeformat
(RAW, JPEG, TIFF, PNG, HEIC). Videofiler ignoreres stille — de logges ikke som hoppet over
siden det er forventet oppførsel. Når `copy_include_videos = true` inkluderes vanlige
videoformat (MP4, MOV, MXF, AVI).

---

## Databasemodell

### `file_copy_operations`

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `source_path` | TEXT | Kildekatalog |
| `destination_path` | TEXT | Destinasjonskatalog (full sti) |
| `device_label` | TEXT (nullable) | Frivillig enhetsnavn |
| `notes` | TEXT (nullable) | Fritekst |
| `status` | TEXT | `pending` / `running` / `completed` / `failed` / `cancelled` |
| `files_total` | INT | Antall filer funnet i kilde |
| `files_copied` | INT | Antall filer kopiert |
| `files_skipped` | INT | Antall filer hoppet over |
| `bytes_total` | BIGINT | Total størrelse av kildefiler |
| `bytes_copied` | BIGINT | Kopierte bytes så langt |
| `verify_after_copy` | BOOL | Snapshot av innstilling ved oppstart |
| `include_videos` | BOOL | Snapshot av innstilling ved oppstart |
| `started_at` | TIMESTAMPTZ | — |
| `completed_at` | TIMESTAMPTZ (nullable) | — |
| `error` | TEXT (nullable) | Toppnivå-feilmelding ved `failed` |
| `input_session_id` | UUID FK (nullable) | Lenke til påfølgende registreringssesjon |

Tabellen er uavhengig av `input_sessions` — en kopieringsoperasjon kan eksistere uten å
lede til en registrering (bruker avbryter), og den kan gjenfinnes i historikk.

### `file_copy_skips`

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `operation_id` | UUID FK | Tilhørende kopieringsoperasjon |
| `source_path` | TEXT | Full sti til kildefilen |
| `reason` | TEXT | `already_exists` / `hash_mismatch` / `read_error` / `write_error` |
| `skipped_at` | TIMESTAMPTZ | — |

---

## Backend

### Kopieringsmotor

Kjøres i `ThreadPoolExecutor` (backend er synkron, operasjonen kan ta minutter).

Algoritme per fil:
1. Sjekk om destinasjonsfilen allerede finnes → `already_exists`, skip
2. Les kildefil i chunks
3. Skriv til destinasjon
4. Hvis `verify_after_copy`: sammenlign SHA256 av kilde og destinasjon
   → ved mismatch: slett kopien, logg `hash_mismatch`
5. Oppdater `files_copied` / `bytes_copied` på operasjonsraden

### API

```
POST /file-copy-operations/suggest-name
     Body: { source_path }
     → { suggested_name: "2026-03-01", files_found: 156, bytes_total: 4521345024 }
     Rask EXIF-skanning uten full bildedekoding.

POST /file-copy-operations
     Body: { source_path, destination_path, device_label?, notes? }
     → { id, status: "running", ... }
     Starter kopieringen asynkront.

GET  /file-copy-operations/{id}
     → Operasjonsstatus med fremdrift

GET  /file-copy-operations/{id}/skips
     → Liste over hoppede over filer

DELETE /file-copy-operations/{id}
     Avbryter en pågående operasjon (status → "cancelled").

GET  /file-copy-operations
     → Historikk, nyeste først
```

---

## Kobling til registreringssesjon

Når bruker klikker «Fortsett til skanning» etter vellykket kopi:
- Scanningssteget pre-fylles med `destination_path`
- Når sesjonen opprettes, settes `file_copy_operations.input_session_id`

Koblingen er informativ — den gjør historikk sporbar («disse bildene ble kopiert fra
minnekortet i denne operasjonen og registrert i denne sesjonen»).

---

## Hva som ikke implementeres (avgrensning)

- **Automatisk katalogstruktur** — hotprevue oppretter ikke `YYYY/MM/DD/`-hierarkier
- **Omdøping av filer** — filnavn beholdes fra kilden
- **Automatisk utskyting av minnekort** — OS-ansvar
- **Differensiell kopi** — ingen synkronisering, kun enveis kopi med skip ved kollisjon
- **Videoregistrering** — videoer kopieres hvis flagget er på, men registreres ikke i
  hotprevue ennå (ingen preview-generering for video)
