# ADR-019: Håndtering av rotasjon ved registrering

**Status:** Planlagt  
**Dato:** 2026-06-04

## Kontekst

Bilder kan roteres i Lokale verktøy (ADR-016) før de registreres. Registrering og
Lokale verktøy er to adskilte systemer — ingenting fra Lokale verktøy gjenbrukes
under registrering. Alle filer prosesseres på nytt fra disk.

Etter registrering behandles filer som frosne. Rotasjon via Lokale verktøy skal
derfor gjøres *før* registrering.

Problemstillingen: klarer registreringen å lese den gjeldende rotasjonstilstanden
korrekt for alle filtyper?

## Analyse

### JPEG

Lokale verktøy skriver `Orientation`-tagen direkte i JPEG-filen via piexif.
`generate_hotpreview()` kaller `ImageOps.exif_transpose()` som leser tagen og
roterer pikslene fysisk før thumbnailing. Hothash beregnes fra de roterte pikslene.

**Status: fungerer korrekt uten endringer.**

### RAW / DNG og andre råformater

Lokale verktøy skriver rotasjon til en XMP sidecar (`IMG_001.xmp`) med
`tiff:Orientation`. Selve RAW-filen endres aldri.

`generate_hotpreview()` bruker rawpy til å dekode RAW-filen og leser
*ikke* XMP sidecar. rawpy returnerer embedded JPEG thumbnail eller full
decode — begge uten XMP-orientering. Hotpreview og hothash fra
registrering reflekterer dermed *ikke* rotasjonen brukeren utførte i
Lokale verktøy.

**Status: feil orientering i hotpreview og hothash.**

### Hvorfor backend ikke skal lese XMP

Originalfiler er kun tilgjengelige for den lokale klient-agenten. Backend
har aldri tilgang til filsystemet der originalene ligger. XMP-reading er
derfor klient-agentens ansvar, ikke backends.

### Hothash og rotasjon

Hothash er SHA256 av hotpreview. Hotpreview skal vise bildet slik brukeren
ser det — med korrekt orientering. Hothash bør derfor reflektere den
roterte visuelle tilstanden, ikke råpikseldata uavhengig av rotasjon.

Siden filer er frosne etter registrering, er hothash stabil etter at den
er beregnet én gang.

## Beslutning

Rotasjonskorrigeringen for RAW gjøres i `client/agent/routers/process.py`,
som har filsystemtilgang og allerede orkestrerer alle prosesseringssteg.
`backend/utils/previews.py` berøres ikke — ingen XMP-kunnskap i backend.

### Endringer i `process.py`

**Ny hjelpefunksjon `_read_raw_orientation(master_path: str) -> int`**

- Søker etter sidecar med samme stamme og `.xmp`/`.XMP`-suffiks
- Parser `tiff:Orientation` fra XML med stdlib `xml.etree.ElementTree`
- Returnerer 1 (ingen rotasjon) hvis ingen sidecar eller tagen mangler
- Kalles bare for RAW-filer

**Ny hjelpefunksjon `_apply_orientation(jpeg_bytes: bytes, orientation: int) -> tuple[bytes, str]`**

- Tar ferdig hotpreview-JPEG og EXIF-orientasjonsverdi (1–8)
- Roterer/speiler med PIL etter standard EXIF-orienteringstabell
- Returnerer nye JPEG-bytes + ny hothash (SHA256)
- Returnerer input uendret hvis orientation == 1

**`POST /process/hash`**

```
1. generate_hotpreview(master)
2. Hvis RAW: les XMP orientation via _read_raw_orientation
3. Hvis orientation != 1: _apply_orientation → nye bytes og hothash
4. Returner korrigerte verdier
```

**`POST /process`**

```
1. generate_hotpreview(master)
2. Hvis RAW: les XMP orientation via _read_raw_orientation
3. Hvis orientation != 1: _apply_orientation → nye bytes og hothash
4. generate_coldpreview — generate_preview() bruker rawpy på samme måte;
   roter coldpreview-bytes med PIL etterpå
5. Returner korrigerte verdier
```

### Sidecar-søk

XMP sidecar kan ha ulikt suffikscasing (`.xmp` / `.XMP`). Søket skal
sjekke begge, likt mønsteret som allerede brukes i `files.py`.

## Konsekvenser

- Hotpreview og hothash for roterte RAW-filer vil være korrekte etter registrering
- `backend/utils/previews.py` og `backend/utils/exif.py` forblir uendret
- XMP-logikken er begrenset til klient-agenten — i tråd med arkitekturprinsippet
  om at klienten eier all filbehandling
- Ingen endring i API-kontrakt mellom klient og backend

## Ikke i scope

- Håndtering av EXIF orientation i embedded RAW thumbnail (separat, eldre bug)
- Orientering i `extract_exif()` for RAW — orientation-feltet sendes til backend
  men brukes ikke kritisk; kan adresseres separat
- Rotasjon av bilder som allerede er registrert (håndteres via BrowseView)
