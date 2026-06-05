# ADR-028: Visningskorreksjoner (PhotoCorrection)

**Status:** Implementert  
**Dato:** 2026-06-05

## Kontekst

Registrerte bilder kan ha visuelle feil som ikke stammer fra innholdet, men fra
opptak- eller skanneprosessen: feil orientering fra EXIF-metadataen, speilvendt
bilde (skannet negativ lagt baklengs inn), skjev horisont, feil eksponering. Disse
feilene skal kunne rettes uten å berøre originalfiler — backend har aldri tilgang
til originaler, og originalfilene anses som frosne etter registrering.

`PhotoCorrection`-tabellen ble opprettet tidlig i prosjektet, men uten et dedikert
API-endepunkt. ADR-016 dokumenterte filnivå-rotasjon (EXIF/XMP) i Lokale verktøy —
det er noe annet: det modifiserer kildefilen *før* registrering. `PhotoCorrection`
er et rent visningslag — coldpreview transformeres på-farten ved servering.

## Beslutning

### Hva PhotoCorrection er

En valgfri rad i `photo_corrections`-tabellen (én per `Photo`) som lagrer
ikke-destruktive visningskorreksjoner. Finnes bare for Photos som har aktive
korreksjoner — tabellen er sparse.

### Pipeline i `serve_coldpreview()`

Korreksjoner appliseres i fast rekkefølge på coldpreview-JPEG ved servering:

```
1. rotation       → 90 / 180 / 270 graders helrotasjon
2. flip_horizontal → speilvendt horisontalt (PIL FLIP_LEFT_RIGHT)
3. horizon_angle  → fin-rotasjon for å rette horisont (±15°, bicubic, auto-crop)
4. crop           → proporsjonal beskjæring (0.0–1.0 per kant)
5. exposure_ev    → lyshetsjustering i EV (log2-skala, PIL Brightness)
```

Original coldpreview på disk røres aldri. Endepunktet svarer med
`Cache-Control: private, max-age=3600` og `ETag: hothash-<correction_timestamp>`.
Frontend cache-buster ved å legge `?t=<correction.updated_at>` på coldpreview-URL
når en korreksjon finnes — dette er en ny URL som aldri er cachet i nettleseren.
`CorrectionPanel` bruker React Query `setQueryData` for umiddelbar oppdatering
av `['photo', hothash]`-cachen med returverdien fra PATCH, slik at URL-parameteren
endres i samme render-syklus som mutasjonen fullføres.

### Rotation og flip_horizontal i PhotoListItem

`rotation` og `flip_horizontal` er denormalisert inn i `PhotoListItem` via Python
`@property`-felter på `Photo`-modellen. Dette gjør det mulig å vise riktig
orientering i thumbnails (CSS `transform: rotate()` og `scaleX(-1)`) uten ekstra
API-kall. Full `PhotoCorrection` er bare tilgjengelig i `PhotoDetail`.

### API-endepunkter

```
PATCH  /photos/{hothash}/correction   Delvis oppdatering — kun angitte felt endres
DELETE /photos/{hothash}/correction   Nullstill alle korreksjoner
```

`PATCH` bruker `exclude_unset=True` (Pydantic): send bare feltene som skal endres.
`null`-verdi sletter et felt (f.eks. `{"rotation": null}` fjerner rotasjon).
Dersom ingen `PhotoCorrection`-rad finnes, opprettes den automatisk.

### Hva PhotoCorrection ikke er

- **Ikke Lokale verktøy-rotasjon** (ADR-016): den skriver til EXIF/XMP på kildefilen
  og gjelder *uregistrerte* bilder. `PhotoCorrection` er uavhengig og berører aldri filer.
- **Ikke en bilderedigerer**: ingen hvitbalanse, ingen denoising, ingen skjerpning.
  Disse operasjonene krever enten originalpiksler eller råfilprosessering og hører
  ikke hjemme på et komprimert 1200px JPEG.

## Gjeldende felt

| Felt | Type | Beskrivelse |
|---|---|---|
| `rotation` | int (nullable) | `90`, `180`, `270` — helrotasjon |
| `flip_horizontal` | bool | Speilvend horisontalt |
| `horizon_angle` | float (nullable) | ±grader for horisontretting |
| `exposure_ev` | float (nullable) | EV-justering (±2.0 er praktisk maks) |
| `crop_left/top/right/bottom` | float (nullable) | Proporsjonal beskjæring, 0.0–1.0 |

## Konsekvenser

- Backend endres aldri: `serve_coldpreview()` er eneste sted korreksjoner appliseres
- Hotpreview i databasen endres ikke — CSS-transform brukes for thumbnails
- Hothash forblir stabil etter registrering
- `?t=<updated_at>`-parameteren og `setQueryData`-mønsteret sikrer umiddelbar
  nettleser-cache-invalidering uten ekstra nettverksforespørsel
- Fremtidig `saturation_adjust` kan legges til her når `saturation_mean` er
  tilgjengelig som kvalitetsmål (PIL `ImageEnhance.Color` er tilstrekkelig)
