# Previews — hotpreview og coldpreview

## Hotpreview

- **Størrelse:** 150×150 px, kvadratisk (crop til midten)
- **Format:** JPEG
- **Lagring:** Base64-kodet direkte i databasen (`Photo.hotpreview_b64`)
- **Formål:** Rask gallerivisning uten diskaksess
- **Hothash:** SHA256 av JPEG-bytene — brukes som unik Photo-ID i hele systemet

Hotpreview genereres én gang ved registrering og endres aldri. Hvis hotpreview må regenereres, vil hothash endre seg og Photo behandles som et nytt bilde.

## Coldpreview

- **Størrelse:** Opptil `coldpreview_max_px` px på lengste kant (standard 1200), proporsjonalt skalert. Styres av `SystemSettings.coldpreview_max_px`.
- **Kvalitet:** JPEG-kvalitet styres av `SystemSettings.coldpreview_quality` (standard 85).
- **Format:** JPEG
- **Lagring:** Disk, under `$COLDPREVIEW_DIR`
- **Katalogstruktur:** `<COLDPREVIEW_DIR>/<ab>/<cd>/<hothash>.jpg` der `ab` og `cd` er de første 4 tegnene av hothash
- **Formål:** Detaljvisning i frontend

Coldpreview er statisk etter generering — endres aldri. Innstillinger i SystemSettings påvirker kun nye registreringer. Korrigert coldpreview følger PhotoCorrection sitt livsløp og genereres fra original coldpreview (ikke fra originalfilen).

## Generering

Begge previews genereres synkront ved registrering. Rekkefølge:
1. Les originalfil
2. Generer hotpreview → beregn hothash
3. Sjekk om hothash allerede finnes i DB (duplikat)
4. Generer coldpreview og skriv til disk
5. Lagre metadata og hotpreview i DB

## Perceptual hashes

To perceptual hashes beregnes fra hotpreview-JPEG under registrering og lagres i `photos`-tabellen:

| Felt | Algoritme | Beskrivelse |
|---|---|---|
| `dct_perceptual_hash` | pHash (DCT) | Discrete Cosine Transform — robust mot moderate bildeendringer. Standard i bransjen. |
| `difference_hash` | dHash | Gradient mellom nabo-piksler — raskere, god for lette beskjæringer og lysjusteringer. |

Begge er 64-bit heltall (`BIGINT`). **Hamming-avstand** mellom to verdier angir visuell likhet — ≤ 10/64 bits tilsvarer trolig samme motiv.

**Beregning:** Fra `jpeg_bytes` i minnet under registrering — ingen ekstra fillesing. Bibliotek: `imagehash`.

**Retroaktiv beregning:** `POST /photos/compute-perceptual-hashes` fyller hashene for eksisterende bilder fra `hotpreview_b64` i databasen — originalfiler trengs ikke.

**Brukstilfeller (fremtidig):**
- Finne NEF/JPEG-par fra samme eksponering på tvers av sesjoner
- Duplikatdeteksjon for bilder med ulik filstørrelse (f.eks. re-eksportert JPEG)
- Burst-deteksjon (bilder tatt med svært lav avstand)

Se `docs/decisions/004-perceptual-hash.md` for full begrunnelse og algoritmediskusjon.

## Synkronisering

Database og coldpreview-filer må alltid synkroniseres sammen mellom maskiner. De er to halvdeler av samme system:
- Database inneholder metadata og hotpreview
- Disk inneholder coldpreview-filer

Ved synkronisering: overfør begge (f.eks. `pg_dump` + `rsync` av coldpreview-katalog).
