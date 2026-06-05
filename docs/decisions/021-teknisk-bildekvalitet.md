# ADR-021: Teknisk bildekvalitet ved registrering

**Status:** Implementert  
**Dato:** 2026-06-04  
**Implementert:** 2026-06-05

## Kontekst

Under registrering prosesseres hvert bilde av klientagenten: hotpreview genereres,
EXIF ekstraheres, coldpreview lagres. På dette tidspunktet er fulloppløst bildedata
tilgjengelig og det er naturlig å beregne objektive kvalitetsmål — uten ekstra
fillesing.

Teknisk vurdering (skarphet, eksponering, støy) er **ikke AI**. Det er klassiske
bildebehandlingsmetrikker som gir deterministiske resultater. De behandles derfor
som kjernedata på linje med EXIF-felter, ikke som AI-data (se ADR-022).

## Beslutning

### Tre målinger

**Skarphet** — to komplementære metoder:

*Laplacian-varians* (primær) — høy varians indikerer skarpe kanter.
Rask og robust, god til relativ sortering innen en serie.

```python
import cv2, numpy as np
gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
```

Typiske verdier: < 50 = uskarpt, 50–200 = akseptabelt, > 200 = skarpt.
Absoluttverdi avhenger av motiv — en tåkescene har naturlig lav varians.

*FFT-analyse* (supplerende) — andel høyfrekvente komponenter i frekvensplanet.
Der Laplacian ikke skiller mellom defokusskarphet og bevegelsessløring,
avslører FFT karakteristisk retningsorientert mønster ved motion blur.
Lagres som `sharpness_fft` (float 0–1, normalisert energiandel over terskel).

```python
fft = np.fft.fft2(gray)
fftshift = np.fft.fftshift(fft)
magnitude = np.abs(fftshift)
h, w = gray.shape
thresh = magnitude[h//2 - h//8:h//2 + h//8, w//2 - w//8:w//2 + w//8].sum()
sharpness_fft = float(1 - thresh / magnitude.sum())
```

**Eksponering** — histogramanalyse.
- `exposure_mean`: gjennomsnittlig lysstyrke (0–255), 128 = nøytral
- `exposure_clipping`: andel piksler i ytterpunktene (< 5 og > 250)
  indikerer ut-blåste høylys eller knuste skygger

```python
mean = float(gray.mean())
clipping = float(((gray < 5).sum() + (gray > 250).sum()) / gray.size)
```

**Støy** — beregnes fra **originalfilen**, ikke coldpreview.

Coldpreview er uegnet fordi nedskalering (f.eks. 6000→1200px) gjennomsnittsberegner
nabopikslene og skjuler sensorstøy, og JPEG-komprimering tilfører systematiske
blokartefakter som forurenser støystatistikken.

Originalen er allerede åpen i klientprosessen under registrering — ingen ekstra
I/O-kostnad. For store filer (>20MP) brukes et 512×512-utsnitt fra bildesenteret.

```python
# Trekk ut patch fra original (allerede i minnet som numpy-array)
h, w = orig.shape[:2]
patch = cv2.cvtColor(
    orig[h//2 - 256:h//2 + 256, w//2 - 256:w//2 + 256],
    cv2.COLOR_RGB2GRAY,
)
# Støyestimat: varians av medianfilter-residualer
noise_score = float((patch - cv2.medianBlur(patch, 5)).std())
```

ISO-verdi fra EXIF lagres allerede og er et kameraoppgitt støymål.
`noise_score` og EXIF ISO utfyller hverandre: ISO sier noe om forventet støy,
`noise_score` måler faktisk støy i pikseldata.

**Farge** — tre mål fra HSV-rom og kanalanalyse:

*Fargesaturation* — gjennomsnittlig metning i HSV-rom.
Indikerer fargerike vs. anemiske bilder. Nyttig for sortering og filtrering.

```python
hsv = cv2.cvtColor(img, cv2.COLOR_RGB2HSV)
saturation_mean = float(hsv[:, :, 1].mean())   # 0–255
```

*Fargetemperaturestimering* — rød/blå-kanalratio i nær-nøytrale piksler.
Gir et grovt estimat av hvitbalanse i Kelvin-retning (varm/kald).
Krever ikke kamerakalibrering — brukes relativt, ikke absolutt.

```python
r, g, b = img[:,:,0].mean(), img[:,:,1].mean(), img[:,:,2].mean()
wb_ratio = float(r / (b + 1e-6))   # > 1 = varm, < 1 = kald
```

*Fargeavvik (cast)* — standardavvik mellom kanalgjennomsnitt.
Høyt avvik indikerer ukorrigert fargecast.

```python
color_cast = float(np.std([r, g, b]))
```

### Sammensatt kvalitetsskår

Et enkelt sammensatt tall (0.0–1.0) kombinerer de tre målingene for
overordnet sortering. Vektingen er tentativ og kan justeres:

```
quality_score = w1 * normalized_sharpness
              + w2 * exposure_score
              - w3 * clipping_penalty
              - w4 * noise_penalty
```

Brukes for "sorter etter kvalitet" i BrowseView — ikke som absolutt dom.

### Hvor beregningen skjer

Beregningen skjer i **`client/agent/routers/process.py`** mens originalfilen
er lastet i minnet — før den frigis etter at coldpreview er skrevet til disk.
Dette gir null ekstra I/O-kostnad.

Alle metrikker beregnes fra **originalen**, med ett unntak:

| Metrikk | Kilde | Begrunnelse |
|---------|-------|-------------|
| Skarphet (Laplacian) | Original | Bevarer findetaljer; ~15ms på 24MP |
| Skarphet (FFT) | Coldpreview | FFT er O(n·log n) — ~30× raskere på 1200px enn 24MP |
| Eksponering | Original | Histogramstatistikk er mer presis fra fulloppløsning |
| Farge | Original | Fargestatistikk er skala-invariant, men originalen er allerede lastet |
| Støy | Original (512×512-patch) | Nedskalering og JPEG-komprimering ødelegger støystatistikken |

Etter at coldpreview er skrevet og metrikker er beregnet, frigis original-arrayen.

Resultatet sendes til backend som del av `GroupPayload` og lagres i `photos`.

### Nye felt på `photos`

```sql
ALTER TABLE photos ADD COLUMN sharpness_score   FLOAT;   -- Laplacian-varians
ALTER TABLE photos ADD COLUMN sharpness_fft     FLOAT;   -- FFT høyfrekvensdel (0–1)
ALTER TABLE photos ADD COLUMN exposure_mean     FLOAT;
ALTER TABLE photos ADD COLUMN exposure_clipping FLOAT;
ALTER TABLE photos ADD COLUMN noise_score       FLOAT;
ALTER TABLE photos ADD COLUMN saturation_mean   FLOAT;   -- HSV-metning (0–255)
ALTER TABLE photos ADD COLUMN wb_ratio          FLOAT;   -- rød/blå-ratio
ALTER TABLE photos ADD COLUMN color_cast        FLOAT;   -- kanals standardavvik
ALTER TABLE photos ADD COLUMN quality_score     FLOAT;   -- sammensatt (0–1)
```

Alle nullable — eksisterende registrerte bilder har ikke disse feltene.
Backfill er mulig via Lokale verktøy / re-skanning, men ikke planlagt nå.

### Avhengigheter

Ingen nye avhengigheter. Implementert med Pillow og numpy — numpy er allerede
tilgjengelig som transitiv avhengighet via `imagehash`. OpenCV er ikke brukt.

## Bruk i frontend

- **Sorteringsvalg i BrowseView:** "Sorter etter skarphet", "Sorter etter kvalitet"
- **Filter:** "Vis bare bilder med quality_score > 0.6"
- **PhotoDetailPage:** Kvalitetsindikatorer i metadatapanel (valgfritt)
- **Stack-forslag:** Beste bilde i en stack identifiseres via quality_score

## Konsekvenser

### Ikke i scope
- Backfill av eksisterende bilder (krever re-prosessering via klientagent)
- Automatisk avvisning av bilder under terskel
- Motivavhengig kalibrering (tåke, natt, portrett har ulike referanseverdier)
- Sammenligning på tvers av kameraer med ulik sensorstørrelse

### Relasjon til ADR-022
Disse feltene er **ikke** AI-data og hører ikke hjemme i AI-laget. De skrives
én gang ved registrering, er deterministiske, og trenger ingen provenansmerking.
