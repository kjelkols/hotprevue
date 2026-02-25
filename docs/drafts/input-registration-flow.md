# Utkast: Registreringsflyt og datamodell for input-sesjon

Status: under diskusjon — ikke klar for spec
Sist oppdatert: 2026-02-25

---

## Avklart: Photo og ImageFile

### Photo

`Photo` erstatter `Image` fullt ut. Den har alle egenskapene `Image` har i dag, pluss fotograf og input-sesjon. Det er den logiske og kreative enheten — det som vises i galleriet, knyttes til events og collections, får rating og tags.

### ImageFile

`ImageFile` er et enkelt register over originalfiler knyttet til et Photo. Den har ingen egen hotpreview, hothash eller EXIF. Den er kun en filpeker — brukes for å finne originalfilene tilhørende et Photo.

Én ImageFile er master: den filen som ble brukt som kilde for Photo sin hotpreview og EXIF ved registrering.

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `photo_id` | UUID FK | Tilhørende Photo |
| `file_path` | string | Absolutt sti til originalfilen |
| `file_type` | string | `RAW`, `JPEG`, `TIFF`, `PNG`, `HEIC` |
| `is_master` | bool | Kildefil for Photo sin hotpreview og EXIF |

### Eksisterende Image-kode

All eksisterende kode med `Image`-entiteten slettes når implementasjon starter. Variabelnavnet `image` passer ikke inn i strukturen og vil skape forvirring. Kodebasen tagges (`pre-spec-cleanup`) slik at nyttige utiliteter (EXIF, preview-generering) kan konsulteres ved behov.

---

## Masterfil

Masterfilens hotpreview og EXIF brukes som Photo sitt grunnlag. **Valget er permanent** — kan ikke endres etter registrering uten å endre hothash, som bryter alle referanser (events, collections, global publisering).

Foreslått prioritetsrekkefølge innen en gruppe:
1. RAW (CR2, CR3, NEF, ARW, ORF, RW2, DNG, RAF, PEF)
2. JPEG/JPG
3. TIFF, PNG, HEIC
4. Andre

Første fil etter prioritet, deretter alfabetisk, blir master.

> **Uavklart:** Er RAW-prioritet riktig? Fotografer forventer gjerne at RAW er primær, men preview-generering fra RAW krever rawpy. Alternativet er å alltid bruke JPEG som master hvis den finnes.

---

## Grupperingsalgoritme

Skanning finner alle bildefiler i katalogtreet rekursivt. Gruppering skjer på:

```
nøkkel = (katalogsti, filnavn-uten-extension, lowercased)
```

Filer med samme nøkkel havner i samme gruppe og blir én Photo med én eller flere ImageFiles.

Filtyper som behandles:
`.jpg`, `.jpeg`, `.png`, `.tiff`, `.tif`, `.heic`, `.heif`, `.cr2`, `.cr3`, `.nef`, `.arw`, `.orf`, `.rw2`, `.dng`, `.raf`, `.pef`

> **Uavklart:** Skal XMP/sidecar-filer detekteres og knyttes til ImageFile? Kan utsettes.

---

## Prosesseringsflyt per gruppe

```
1. Bestem masterfil (prioritetsregle)
2. Generer hotpreview fra masterfil
     → Pillow for JPEG/PNG/TIFF/HEIC
     → rawpy (embedded JPEG-thumbnail) for RAW
3. Beregn hothash = SHA256(hotpreview-bytes)
4. Sjekk duplikat: finnes hothash i photos-tabellen?
     → Ja: marker som duplikat, hopp til neste gruppe
     → Nei: fortsett
5. Ekstraher EXIF fra masterfil
6. Opprett Photo (hothash, hotpreview, exif, photographer_id, session_id)
7. Generer coldpreview → skriv til disk
8. Opprett én ImageFile per fil i gruppen (file_path, file_type, is_master)
```

---

## Foreslått datamodell

### Photo

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `hothash` | string (unique) | SHA256 av masterfilens hotpreview |
| `hotpreview_b64` | text | Generert fra masterfil |
| `coldpreview_path` | string (nullable) | — |
| `exif_data` | jsonb | EXIF fra masterfil |
| `taken_at` | datetime (nullable) | Fra EXIF |
| `rating` | int (nullable) | 1–5 |
| `tags` | string[] | — |
| `description` | text (nullable) | — |
| `photographer_id` | UUID FK | Aldri null |
| `input_session_id` | UUID FK (nullable) | — |
| `event_id` | UUID FK (nullable) | — |
| `stack_id` | UUID (nullable) | — |
| `is_stack_cover` | bool | — |
| `registered_at` | datetime | — |

### ImageFile

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `photo_id` | UUID FK | Tilhørende Photo |
| `file_path` | string | Absolutt sti til originalfilen |
| `file_type` | string | `RAW`, `JPEG`, `TIFF`, `PNG`, `HEIC` |
| `is_master` | bool | Kildefil for Photo sin hotpreview og EXIF |

---

## Foreslått registreringsflyt i frontend

```
[Ny sesjon]
  → Navn på sesjon
  → Velg fotograf
  → Velg kildekatalog
      ↓
[Skann]   POST /input-sessions/{id}/scan
  → Viser gruppesammendrag:
    "47 grupper · 23 RAW+JPEG-par · 20 JPEG-kun · 4 RAW-kun"
      ↓
[Bekreft]   POST /input-sessions/{id}/process
  → Fremdriftsvisning
      ↓
[Ferdig]
  "45 registrert · 2 duplikater · 0 feil"
```

> **Uavklart:** Skal review-steget (skann → vis grupper → bekreft) være med, eller skal skann og prosessering skje i ett trinn?

---

## Åpne spørsmål

| Nr | Spørsmål | Konsekvens |
|---|---|---|
| 1 | RAW eller JPEG som master ved par? | Påvirker avhengigheter (rawpy) |
| 2 | Skal rawpy være en avhengighet fra start? | RAW-only grupper uten rawpy kan ikke registreres |
| 3 | Review-steg i frontend — ja eller nei? | Påvirker API-design (to endepunkter vs ett) |
| 4 | Synkron eller asynkron prosessering? | Asynkron er bedre UX for store kataloger, men mer kompleksitet |
| 5 | Grupper med 3+ filer — flagges for bruker? | Kan indikere navnekollisjon eller usikker gruppering |
| 6 | XMP/companion-deteksjon i scope for MVP? | Kan utsettes |

---

## Neste steg

Når spørsmålene over er avklart, fordeles innholdet til:
- `spec/domain.md` — Photo, ImageFile, oppdatert terminologi
- `spec/data-model.md` — nye tabeller, oppdaterte relasjoner
- `spec/api.md` — nye endepunkter for input-sesjon og registrering
- `decisions/` — ADR for master-valg og rawpy
