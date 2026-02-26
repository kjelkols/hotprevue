# Testbilder

Reelle kamerabilder brukt for integrasjonstesting av registrerings- og EXIF-logikk.
Bildene ligger ikke i git-repoet, men som assets i en GitHub Release.

## Release: test-assets-v1

### test-images-small.tar.gz (~liten, 2 filer)

Brukes i vanlige tester. Et matchende RAW+JPEG-par fra Nikon D800:

| Fil | Format |
|-----|--------|
| nikon_d800.JPG | JPEG |
| nikon_d800.NEF | NEF (RAW) |

### test-images.tar.gz (~350 MB, 20 filer)

Fullstendig samling fra ulike kameraer. Brukes for bredere kompatibilitetstesting.

| Kamera | Format |
|--------|--------|
| Canon Digital IXUS | JPEG |
| Nikon D100, D300, D700, D800 | JPEG + NEF (RAW) |
| Pentax K-r | JPEG + PEF (RAW) |
| Sony H8324, XQ-BC52 | JPEG + DNG (RAW) |
| Panasonic DMC-FT3 | JPEG |
| Samsung SM-N9005, SN-M905 | JPEG |
| Motorola Moto G23 | JPEG (inkl. HDR-variant) |
| Honor LLY-NX1 | JPEG |
| Skannet bilde (uten EXIF) | JPEG |

## Nedlasting

```sh
# Lite sett (anbefalt for vanlig utvikling)
gh release download test-assets-v1 \
  --pattern "test-images-small.tar.gz" \
  --repo kjelkols/hotprevue \
  --output test-images-small.tar.gz
tar xzf test-images-small.tar.gz -C .test-images/

# Fullt sett
gh release download test-assets-v1 \
  --pattern "test-images.tar.gz" \
  --repo kjelkols/hotprevue \
  --output test-images.tar.gz
tar xzf test-images.tar.gz -C .test-images/
```

## Oppdatere testbildene

```sh
# Pakk og last opp på nytt (overskriver eksisterende asset)
tar czf test-images-small.tar.gz -C /sti/til/bilder .
gh release upload test-assets-v1 test-images-small.tar.gz \
  --repo kjelkols/hotprevue \
  --clobber
```
