# ADR-030: Nedlasting og deling av bilder

**Status:** Erstattet av ADR-045 (2026-06-09)  
**Dato:** 2026-06-05

> Innholdet er konsolidert inn i [ADR-045: Deling og leveranse](045-deling-og-leveranse.md).
> Del 1 (nedlasting) og Del 2 (Web Share API) i ADR-045 dekker dette.

## Kontekst

Brukere trenger å ta bilder ut av Hotprevue — enten for å sende dem videre,
legge dem ved e-post, publisere på nett eller arkivere. Det finnes i dag et
`/photos/{hothash}/coldpreview`-endepunkt som serverer korrigert JPEG for
visning i nettleseren, men det er ikke egnet for nedlasting: ingen EXIF-data
legges inn, og svaret er ikke merket for nedlasting.

Coldpreview er alltid maks ~1200px — det er den faktiske øvre grensen for
det systemet kan levere. (Backend leser aldri originalfiler.) For mange
brukstilfeller er 1200px for stort: SMS/MMS har grenser på typisk 300–600 kB,
og e-postvedlegg bør helst være under 1 MB.

## Vurderinger

### Hva brukeren faktisk trenger

| Brukstilfelle | Typisk størrelse |
|---|---|
| Arkivering / print | Full coldpreview (~1200px) |
| E-post (Gmail, Apple Mail) | 800–1200px |
| Meldingsapp (WhatsApp, iMessage) | 400–800px |
| SMS/MMS | ≤ 400px |
| Deling til sosiale medier | 800–1200px |

Tre størrelsesnivåer dekker dette: **full** (ingen nedskalering), **medium**
(maks 1200px), **liten** (maks 600px). Full og medium er i praksis det
samme siden coldpreview allerede er 1200px, men den eksplisitte parameteren
gjør det tydelig for klienten.

### Hvilke metadata skal inn

Nedlastet JPEG bør inneholde:

**Fra originalen (overføres fra Photo/ImageFile):**
- `DateTimeOriginal` — opptakstidspunkt
- `Make`, `Model` — kamerafabrikant og modell
- `LensModel` — objektivmodell
- `ISOSpeedRatings`, `FNumber`, `ExposureTime`, `FocalLength`
- GPS-koordinater (lat/lng) hvis de finnes

**Fra Hotprevue:**
- `Artist` — fotografens navn (fra `Photographer.name`)
- `Copyright` — fotografens navn
- `Software` — `"Hotprevue"`
- `ImageDescription` — `"hothash:{hothash}"`
  (kompakt, maskinlesbar, vises i de fleste EXIF-visere)
- `UserComment` — `Hotprevue` + korreksjoner hvis de finnes (se under)

**UserComment-format:**

Ingen korreksjoner:
```
Hotprevue
```
Med korreksjoner:
```
Hotprevue|corrections:rotation=90,exposure_ev=+0.5
```

Hothash utelates fra `UserComment` — den er allerede i `ImageDescription`.
Korreksjoner er viktige fordi nedlastet bilde kan avvike visuelt fra
originalen — en mottaker bør vite at bildet er bevisst rotert/beskjært.

**Hva som utelates:**
- `rating` og `tags` — ikke standard EXIF-felt; ville krevd XMP eller
  IPTC. Kan legges til i fremtidig versjon via XMP-blokk.
- Arrangement/event-navn — for Hotprevue-intern kontekst, ikke egnet som
  universell EXIF-metadata. Kan nevnes i `UserComment` hvis ønskelig.

### EXIF-skriving: `piexif`

`piexif` er et lite, rent Python-bibliotek for å lese og skrive EXIF i
JPEG-filer. Pillow kan lagre EXIF ved å sende `piexif.dump(exif_dict)` som
`exif`-parameter til `img.save()`. `piexif` er ikke i dag i
`backend/pyproject.toml` og må legges til.

**Alternativ vurdert:** `exiv2` (via `pyexiv2`) — kraftigere (XMP + IPTC),
men tung C++-avhengighet og ikke nødvendig for dette omfanget.

### Deling fra nettleseren: Web Share API

`navigator.share({ files: [file] })` — tilgjengelig i:
- iOS Safari 15+ ✓
- Android Chrome ✓
- macOS Safari ✓
- Windows Edge (delvis) ✓
- Chrome desktop: varierer

Når det støttes, åpner det OS-ets native delingsark og dekker automatisk
Gmail, WhatsApp, iMessage, AirDrop, Telegram osv. — **ingen plattformspesifikke
knapper er nødvendige**. Frontend sjekker `navigator.canShare?.({ files })` og
viser Del-knappen bare når det er støttet. Faller tilbake til ren nedlasting.

**Vurderte alternativer avvist:**
- Dedikert Gmail-knapp: `mailto:` støtter ikke filvedlegg. Alternativet
  (åpne Gmail i ny fane med lenke i brødteksten) er for tungvint og krever
  at serveren er nettverkstilgjengelig for mottakeren.
- Kopier bildlenke: nyttig bare hvis backend er offentlig tilgjengelig, noe
  den ikke er i typisk hjemmelabboppsett.
- QR-kode: unødvendig når Web Share API dekker mobil-til-mobil-scenariet.

### Filnavn

```
{hothash}.jpg
```

Fullt hothash som filnavn — globalt unikt, sporbart, ingen kollisjon.

## Beslutning

### Backend: nytt `/photos/{hothash}/download`-endepunkt

```
GET /photos/{hothash}/download?size=full|medium|small
```

| `size` | Maks dimensjon | Brukstilfelle |
|---|---|---|
| `full` (standard) | ingen (som coldpreview) | arkiv, print |
| `medium` | 1200px | web, e-post |
| `small` | 600px | meldingsapper |

Endepunktet:
1. Henter foto + photographer + correction fra databasen
2. Åpner coldpreview fra disk
3. Appliserer korreksjoner (via `serve_coldpreview`-logikken)
4. Skalerer ned ved behov (Lanczos)
5. Bygger EXIF-dict med piexif
6. Lagrer til buffer med `img.save(buf, format="JPEG", quality=85, exif=...)`
7. Svarer med `Content-Disposition: attachment; filename="..."`

Cachehoder: `Cache-Control: no-store` — nedlastede filer bør ikke bufres
i nettleseren; de kan inneholde korreksjoner som endres.

### Backend: `/photos/{hothash}/coldpreview` får også EXIF

`serve_coldpreview()` ble utvidet til å alltid embed EXIF — samme pipeline
som `/download`. Dette betyr at høyreklikk → Lagre bilde i nettleseren
gir en fil med korrekte metadata, ikke bare en "naken" JPEG.

Konsekvens: coldpreview re-enkodes alltid via PIL (tidligere ble råbytes
returnert direkte fra disk ved ingen korreksjon). Overhead er akseptabel
for et enkeltbruker-system.

### Backend: ny `piexif`-avhengighet

Legges til i `backend/pyproject.toml`:
```toml
"piexif>=1.1",
```

### Frontend: nedlastings- og delingsknapper i PhotoDetail

På detaljsiden (`PhotoDetailPage`):

```
[ Last ned ▾ ]   [ Del ]
     full
     medium
     small
```

- **Last ned**: dropdown med tre størrelser. Standard: `full`.
- **Del**: vises kun hvis `navigator.canShare?.({ files: [...] })` returnerer `true`.
  Henter `?size=medium` som standard (god størrelse for deling), sender til
  `navigator.share({ files: [file], title: "Foto {dato}" })`.

Knappene plasseres i eksisterende handlingsrad på detaljsiden.

### Frontend: kontekstmenyvalg i PhotoGrid

Nytt valg i kontekstmenyen på thumbnail: **"Last ned (full)"** — kaller
direkte `window.open(/photos/{hothash}/download)` uten størrelsesvalg.
Batch-nedlasting er utenfor scope for denne ADR-en.

## Utenfor scope

- **Batch-nedlasting** (zip av flere bilder) — kandidat for fremtidig ADR
- **XMP-blokk** med `rating`, `tags`, arrangement — kan legges til i piexif
  er allerede i avhengighetssettet
- **Vannmerking** — ikke aktuelt for dette systemet
- **Andre formater** (PNG, TIFF) — coldpreview er alltid JPEG

## Konsekvenser

- `piexif>=1.1` er ny backend-avhengighet (ca. 20 kB, rent Python); importeres
  øverst i `photo_service.py` slik at alle hjelpefunksjoner har tilgang
- Alle JPEG-er som forlater systemet (via `/coldpreview` eller `/download`)
  inneholder fullstendig EXIF-proveniensdata: kamera, fotograf, hothash, GPS
- Hothash i `ImageDescription` gjør bildet sporbart tilbake til Hotprevue-basen
  uavhengig av filnavn eller kontekst
- Visuelle korreksjoner dokumenteres i `UserComment` — mottaker vet at bildet
  er bevisst endret fra originalen
- Web Share API gir native mobilplattformdeling uten plattformspesifikke integrasjoner
- Coldpreview re-enkodes alltid via PIL (ikke raw bytes fra disk) — marginal
  ekstra latens, men konsistent EXIF i alle leveringskanaler
