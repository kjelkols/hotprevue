# Utkast: Registreringsflyt og datamodell for input-sesjon

Status: under diskusjon — ikke klar for spec
Sist oppdatert: 2026-02-25

---

## Bakgrunn

Dette dokumentet beskriver et forslag til hvordan registrering av bilder via katalogskanning skal fungere, og introduserer to nye entiteter: `Photo` og `ImageFile`. Mange ting er ikke avklart ennå.

---

## Kjerneendring: Photo og ImageFile erstatter Image

Nåværende `Image`-entitet representerer én fil og ett logisk fotografi i ett. Det holder ikke for RAW+JPEG-par og liknende.

Forslaget er å dele dette i to:

- **Photo** — det logiske fotografiet (ett opptak, én kreativ enhet). Det som vises i galleriet, knyttes til events og collections, får rating og tags.
- **ImageFile** — én fysisk fil på disk. Et Photo har én eller flere ImageFiles. Én av dem er master.

Eksisterende `Image`-tabell og all tilhørende kode må erstattes. Dette er en stor endring og må gjøres koordinert.

---

## Masterfil

Én ImageFile i en gruppe er master. Masterfilens hotpreview kopieres til Photo. Photo.hothash = masterfilens hothash. **Valget er permanent** — kan ikke endres etter registrering uten å endre hothash, som bryter alle referanser (events, collections, global publisering).

Foreslått prioritetsrekkefølge:
1. RAW (CR2, CR3, NEF, ARW, ORF, RW2, DNG, RAF, PEF)
2. JPEG/JPG
3. TIFF, PNG, HEIC
4. Andre

Første fil etter prioritet, deretter alfabetisk, blir master.

> **Uavklart:** Er RAW-prioritet riktig? Fotografer forventer gjerne at RAW er primær, men det krever rawpy for preview-generering. Alternativet er å alltid bruke JPEG som master hvis den finnes — enklere implementasjon, men avviker fra faglig konvensjon.

---

## Grupperingsalgoritme

Skanning finner alle bildefiler i katalogtreet. Gruppering skjer på:

```
nøkkel = (katalogsti, filnavn-uten-extension, lowercased)
```

Filer med samme nøkkel havner i samme gruppe og blir én Photo med flere ImageFiles.

Filtyper som behandles som bildefiler:
`.jpg`, `.jpeg`, `.png`, `.tiff`, `.tif`, `.heic`, `.heif`, `.cr2`, `.cr3`, `.nef`, `.arw`, `.orf`, `.rw2`, `.dng`, `.raf`, `.pef`

XMP/sidecar-filer (`.xmp`) grupperes på samme nøkkel, men er ikke ImageFiles — de knyttes som companion til tilhørende ImageFile.

> **Uavklart:** Er XMP-deteksjon i scope for første versjon av registrering?

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
8. For hver fil i gruppen:
     a. Generer hotpreview
     b. Beregn hothash
     c. Ekstraher EXIF
     d. Opprett ImageFile (photo_id, file_path, file_type, hotpreview, hothash, is_master)
```

---

## Foreslått datamodell

### Photo

| Felt | Type | Beskrivelse |
|---|---|---|
| `id` | UUID PK | — |
| `hothash` | string (unique) | SHA256 av masterfilens hotpreview |
| `hotpreview_b64` | text | Kopi av masterfilens hotpreview |
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
| `file_path` | string | Absolutt sti |
| `file_type` | string | `RAW`, `JPEG`, `TIFF`, `PNG`, `HEIC` |
| `hothash` | string (unique) | SHA256 av denne filens hotpreview |
| `hotpreview_b64` | text | Denne filens egen hotpreview |
| `exif_data` | jsonb (nullable) | Denne filens EXIF |
| `is_master` | bool | Er dette masterfilen? |

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
| 1 | RAW eller JPEG som master ved par? | Påvirker preview-kvalitet og avhengigheter (rawpy) |
| 2 | Skal rawpy være en avhengighet fra start? | RAW-only grupper uten rawpy kan ikke registreres |
| 3 | Review-steg i frontend — ja eller nei? | Påvirker API-design (to endepunkter vs ett) |
| 4 | Synkron eller asynkron prosessering? | Asynkron er bedre UX for store kataloger, men mer kompleksitet |
| 5 | Grupper med 3+ filer — flagges for bruker? | Kan indikere navnekollisjon eller usikker gruppering |
| 6 | XMP/companion-deteksjon i scope for MVP? | Kan utsettes |
| 7 | Hva skjer med eksisterende `Image`-kode og tester? | Må migreres/slettes koordinert |

---

## Neste steg

Når spørsmålene over er avklart, skal innholdet herfra fordeles til:
- `spec/domain.md` — Photo, ImageFile, oppdatert Bilde-seksjon
- `spec/data-model.md` — nye tabeller, oppdaterte relasjoner
- `spec/api.md` — nye endepunkter for input-sesjon og registrering
- `decisions/` — én ADR per større beslutning (master-valg, rawpy, synkron/asynkron)
