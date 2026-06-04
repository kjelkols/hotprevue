# ADR-021: Teknisk bildekvalitet ved registrering

**Status:** Planlagt  
**Dato:** 2026-06-04

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

**Skarphet** — Laplacian-varians av gråtonebildet.
Høy varians indikerer skarpe kanter. Lav varians indikerer uskarphet eller
bevegelsessløring. Beregnes på coldpreview (tilstrekkelig oppløsning).

```python
import cv2
gray = cv2.cvtColor(img, cv2.COLOR_RGB2GRAY)
sharpness = float(cv2.Laplacian(gray, cv2.CV_64F).var())
```

Typiske verdier: < 50 = uskarpt, 50–200 = akseptabelt, > 200 = skarpt.
Absoluttverdi avhenger av motiv — en tåkescene har naturlig lav varians.
Brukes primært til relativ sortering innen samme serie.

**Eksponering** — histogramanalyse.
- `exposure_mean`: gjennomsnittlig lysstyrke (0–255), 128 = nøytral
- `exposure_clipping`: andel piksler i ytterpunktene (< 5 og > 250)
  indikerer ut-blåste høylys eller knuste skygger

```python
mean = float(gray.mean())
clipping = float(((gray < 5).sum() + (gray > 250).sum()) / gray.size)
```

**Støy** — estimert fra flate bildeområder.
Standardavviket i lavgradient-regioner isolerer støy fra tekstur.
Implementeres med medianfilteringsresidualer (enkelt og robust).

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

Beregningen skjer i **`client/agent/routers/process.py`** etter at coldpreview
er generert. Coldpreview (maks 1200px JPEG) er tilstrekkelig grunnlag — ingen
ekstra fillesing nødvendig.

Resultatet sendes til backend som del av `GroupPayload` og lagres i `photos`.

### Nye felt på `photos`

```sql
ALTER TABLE photos ADD COLUMN sharpness_score   FLOAT;
ALTER TABLE photos ADD COLUMN exposure_mean      FLOAT;
ALTER TABLE photos ADD COLUMN exposure_clipping  FLOAT;
ALTER TABLE photos ADD COLUMN noise_score        FLOAT;
ALTER TABLE photos ADD COLUMN quality_score      FLOAT;
```

Alle nullable — eksisterende registrerte bilder har ikke disse feltene.
Backfill er mulig via Lokale verktøy / re-skanning, men ikke planlagt nå.

### Avhengigheter

`opencv-python-headless` legges til i klientagentens avhengigheter.
PIL/Pillow (allerede i bruk) kan brukes som alternativ for enklere
implementasjoner, men OpenCV er mer presist for Laplacian-beregning.

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
