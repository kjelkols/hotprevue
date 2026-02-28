# 004 — Perceptual hash på Photo

## Status

Implementert (migrasjon 0008, 2026-02-28)

## Kontekst

`hothash` er `SHA256(hotpreview_jpeg)` — en eksakt innholds-hash. To bilder er identiske bare hvis hashen er 100 % lik. En **perceptual hash** er et fingeravtrykk av det *visuelle innholdet*. Bilder med lav **Hamming-avstand** mellom hashene er visuelt like, selv om de ikke er byte-identiske.

### Hva dekker `hothash`, og hva dekker det ikke?

| Brukstilfelle | hothash | perceptual hash |
|---|---|---|
| Identisk fil registrert to ganger | ✅ | ✅ |
| NEF og JPEG fra samme eksponering | ❌ | ✅ (lav avstand) |
| Lett beskåret variant | ❌ | ✅ |
| Ulik eksponering av samme motiv | ❌ | ~✅ |
| Rotert 90° | ❌ | ❌ (avhenger av algoritme) |

---

## Algoritmer

### dHash (Difference Hash)
- Skalerer bildet til 9×8 piksler, beregner gradient (lysere/mørkere) mellom nabo-piksler → 64-bit hash
- Raskest av alle, ren Python, robust mot støy og kontrastendringer
- Tommelfingerregel: Hamming-avstand ≤ 10/64 bits ≈ «trolig samme bilde»

### pHash (DCT Perceptual Hash)
- Bruker Discrete Cosine Transform — samme matematikk som JPEG-komprimering
- Skalerer til 32×32, tar DCT, bruker øverste venstre 8×8 → 64-bit hash
- Mer robust enn dHash for moderate bildeendringer, noe tregere
- Industristandard for duplikatdeteksjon i fotoprogrammer

### aHash (Average Hash)
- Enklest: 8×8 gjennomsnitt → 64-bit. Rask men lite robust. Ikke anbefalt.

### Wavelet Hash
- Bruker wavelet-transform, mer robust for noen transformasjoner. Tyngre enn de over.

---

## Hva bruker andre fotoprogrammer?

**digiKam** — pHash for duplikatdeteksjon, lagret i SQLite. Søker med Hamming-avstand ≤ 10.

**PhotoStructure** — pHash via sharp/libvips. Brukes til å finne «master» blant duplikater på tvers av kataloger.

**ImageMagick** — `compare -metric PHASH` som offisielt verktøy.

**Mylio** — Duplikatdeteksjon kombinerer metadata + perceptual likhet. Proprietær.

**Immich** (open source) — Bruker ML-embeddings for scenelikhet; community etterspør pHash for enkle duplikater.

**Google Photos / Apple Photos** — Deep learning-embeddings, totalt annen skala. Ikke relevant for selvhostet løsning.

---

## Lagring

En 64-bit hash passer naturlig i `BIGINT` (8 bytes per rad — ubetydelig). PostgreSQL støtter Hamming-avstand med bitoperatorer:

```sql
-- Antall bits som er ulike (Hamming-avstand):
SELECT bit_count(a.phash # b.phash)
FROM photos a, photos b
WHERE a.id != b.id
  AND bit_count(a.phash # b.phash) <= 10;
```

`BIT(64)` er alternativet for eksplisitt bittype, men `BIGINT` er enklere å jobbe med fra Python.

---

## Beregning

### Ingen ekstra kostnad ved registrering

`hotpreview_b64` er lagret som base64-tekst i `photos`-tabellen. Algoritmene (`dHash`, `pHash`) skalerer uansett ned til 8×8 eller 32×32 piksler internt — en 150×150 hotpreview er mer enn tilstrekkelig som input.

**Under registrering** — `jpeg_bytes` er allerede i minnet:
```python
import imagehash
from PIL import Image
import io

img = Image.open(io.BytesIO(jpeg_bytes))
phash_value = int(str(imagehash.dhash(img)), 16)  # lagres som BIGINT
```

Beregning tar < 1 ms per bilde.

**Retroaktivt for eksisterende bilder** — hotpreview er tilgjengelig i DB:
```python
import base64
jpeg_bytes = base64.b64decode(photo.hotpreview_b64)
img = Image.open(io.BytesIO(jpeg_bytes))
phash_value = int(str(imagehash.dhash(img)), 16)
```

Originalfilen trengs ikke. Alle eksisterende registrerte bilder kan få phash fylt ut uten å røre filsystemet.

### Python-bibliotek

`imagehash` — ren Python, ingen systemavhengigheter:
```
uv add imagehash
```

---

## Begrensninger

- **Global søk er O(N²)** — for 50 000 bilder er det 2,5 mrd sammenligninger uten indeks. Praktisk bruk: søk innen sesjon, innen dato-vindu, eller med [pgvector](https://github.com/pgvector/pgvector) for ANN-søk om skala krever det.
- **Burst-serier** gir lav avstand til hverandre — terskel må tilpasses.
- **pHash er ikke rotasjons-invariant** — rotert 90° gir stor avstand.

---

## Beslutning

Legge til `phash BIGINT NULL` på `photos`-tabellen.

- **Algoritme:** `dHash` (64 bit). Tilstrekkelig for primærbrukstilfellet (NEF↔JPEG-par, lette duplikater), enklest å implementere og raskest. `pHash` kan introduseres som alternativ uten skjemaendring om man ønsker mer robusthet.
- **Beregnes:** Fra hotpreview under registrering. Retroaktiv beregning via bakgrunnsjobb som leser `hotpreview_b64` fra DB.
- **Bibliotek:** `imagehash`.
- **Brukes ikke til noe ennå** — feltet legges til som grunnlag for fremtidig duplikatdeteksjon.
