# ADR-016: Bilderotasjon via EXIF og XMP sidecar

**Status:** Implementert  
**Dato:** 2026-06-03

## Kontekst

Brukere trenger å korrigere orientering på bilder i preorganiseringsvisningen. Originalfiler skal ikke røres unødvendig — rotasjon skal være lossless og reversibel.

## Beslutning

### Strategi per filtype

| Filtype | Metode | Begrunnelse |
|---------|--------|-------------|
| JPEG (.jpg, .jpeg) | Skriv `Orientation`-tag med `piexif` | Lossless — modifiserer kun EXIF-metadata i originalfil |
| RAW (CR2, NEF, ARW, DNG, …) | Skriv XMP sidecar (`IMG_1234.xmp`) | Rør aldri RAW-originalfil |
| PNG / TIFF / HEIC | XMP sidecar | Unngår risiko ved PIL EXIF-skriving til disse formatene |

### Dataflyt

```
UI (rotasjonsknapp: ↻ / ↺)
  → POST /files/rotate  { file_path, direction: "cw" | "ccw" }
      1. Les gjeldende Orientation (EXIF eller XMP sidecar)
      2. Beregn ny Orientation (matrise: 1→6→3→8→1 for cw)
      3. Skriv tilbake (piexif for JPEG / opprett/oppdater .xmp for RAW/andre)
      4. Regenerer hotpreview fra disk (nå korrekt orientert)
      5. Oppdater prescan_cache: hothash, hotpreview_b64, orientation
  ← Returnerer { new_hotpreview_b64, new_hothash, orientation }

UI: oppdaterer thumbnail og lightbox inline — ingen re-scan nødvendig
```

### Sannhetskilde for rotasjon

Rotasjon skrives **umiddelbart til fil** ved knappetrykk (Alternativ 1). prescan_cache holdes i sync. Ingen mellomlagring eller "Bruk"-steg.

### UI-plassering

Rotasjonsknapper vises i **begge** visninger:
- `FileGroupTile.tsx` — som hover-ikon på thumbnail (rask workflow)
- `PreviewLightbox.tsx` — som knapper i verktøylinje

### Orientation-matrise (EXIF-verdier)

```
CW:  1→6→3→8→1   (og 2→7→4→5→2 for speilvendte)
CCW: 1→8→3→6→1
```

## Konsekvenser

### Endringer som kreves

1. **Bug-fix (uavhengig):** `generate_hotpreview()` i `previews.py` ignorerer EXIF Orientation — må bruke `ImageOps.exif_transpose()` som `generate_preview()` allerede gjør.

2. **`prescan_cache`:** Legg til `orientation INTEGER`-kolonne.

3. **`prescan.py`:** Les og lagre Orientation ved skanning.

4. **Ny ruter:** `POST /files/rotate` i `client/agent/routers/files.py` — håndterer EXIF-skriving (piexif) og XMP sidecar-skriving.

5. **XMP sidecar:** Enkel skriving av `<xmp:Orientation>` / `tiff:Orientation` — ingen full XMP-parsing nødvendig for rotasjon.

6. **Frontend:**
   - `FileGroupTile.tsx` — hover-knapper for ↻/↺
   - `PreviewLightbox.tsx` — knapper i verktøylinje
   - Ny API-funksjon i `src/api/` for `/files/rotate`
   - Oppdater thumbnail/lightbox inline fra respons

### Ikke i scope

- Lossless piksel-rotasjon (jpegtran) — EXIF er tilstrekkelig
- Undo/redo — brukeren kan rotere tilbake manuelt
