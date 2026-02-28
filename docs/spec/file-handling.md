# Filhåndtering

## Originalfiler

Hotprevue rører aldri originalfilene. Systemet lagrer kun:
- Absolutt filsti til originalfilen (via ImageFile)
- Metadata og EXIF lest ved registrering
- Hotpreview (generert kopi, 150×150)

Brukeren har full kontroll over hvor og hvordan originalene organiseres. Systemet gir oversikt og støtte — ingen automatisk flytting, omdøping eller sletting.

## ImageFile og tilknyttede filer

Hvert Photo har én eller flere ImageFiles — filpekere til originalfiler på disk. Følgende filtyper registreres:

| Type | Eksempel |
|---|---|
| `RAW` | `.cr2`, `.cr3`, `.nef`, `.arw` |
| `JPEG` | `.jpg`, `.jpeg` |
| `TIFF` | `.tif`, `.tiff` |
| `PNG` | `.png` |
| `HEIC` | `.heic`, `.heif` |
| `XMP` | Adobe/Darktable sidecar med redigeringshistorikk |

ImageFiles detekteres automatisk ved registrering ved gruppering på filnavnstamme. XMP-filer lagres som ImageFile med `file_type = "XMP"` — innholdet leses ikke, men filstien bevares for bruk med eksterne programmer.

## Filstivalidering

Systemet bør periodisk sjekke at lagrede filstier fortsatt er gyldige:
- Fil eksisterer og er lesbar → status `ok`
- Fil ikke funnet → status `missing`
- Fil funnet men endret (størrelse/dato) → status `modified`

Brukeren varsles om manglende filer og kan oppdatere filstien manuelt (f.eks. ved at originalene er flyttet til ny disk).

## Batch-oppdatering av filstier

Hvis brukeren flytter en hel samling til ny disk eller ny sti, skal det finnes et verktøy for å batch-oppdatere filstier med et søk-og-erstatt på stiprefikset.

Eksempel: endre alle stier fra `/mnt/old-disk/` til `/mnt/new-disk/`.

Se `file-reconciliation.md` for fullstendig strategi og implementasjonsplan.

## Synkstrategi

Se `previews.md` for synkronisering av database og coldpreview.

For originalfiler:
- Brukeren er ansvarlig for backup og synk av originaler
- Systemet validerer kun at filstiene er tilgjengelige
- Ved synk mellom maskiner: oppdater filstier hvis originalene ligger på annen sti på ny maskin
