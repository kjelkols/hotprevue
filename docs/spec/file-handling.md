# Filhåndtering

## Originalfiler

Hotprevue rører aldri originalfilene. Systemet lagrer kun:
- Absolutt filsti til originalfilen
- Metadata og EXIF lest ved registrering
- Hotpreview (generert kopi, 150×150)

Brukeren har full kontroll over hvor og hvordan originalene organiseres. Systemet gir oversikt og støtte — ingen automatisk flytting, omdøping eller sletting.

## Filstivalidering

Systemet bør periodisk sjekke at lagrede filstier fortsatt er gyldige:
- Fil eksisterer og er lesbar → status `ok`
- Fil ikke funnet → status `missing`
- Fil funnet men endret (størrelse/dato) → status `modified`

Brukeren varsles om manglende filer og kan oppdatere filstien manuelt (f.eks. ved at originalene er flyttet til ny disk).

## Companion files

Hvert bilde kan ha en liste av tilknyttede filer med ulik rolle:

| Type | Eksempel |
|---|---|
| `RAW` | `.cr2`, `.nef`, `.arw` |
| `JPEG` | Alternativ JPEG-versjon |
| `XMP` | Adobe sidecar med redigeringshistorikk |
| `SIDECAR` | Andre metadatafiler |

Companion files registreres manuelt eller automatisk ved registrering (f.eks. RAW+JPEG-par detekteres basert på filnavn). Filstier valideres på samme måte som originalfiler.

## Batch-oppdatering av filstier

Hvis brukeren flytter en hel samling til ny disk eller ny sti, skal det finnes et verktøy for å batch-oppdatere filstier med et søk-og-erstatt på stiprefikset.

Eksempel: endre alle stier fra `/mnt/old-disk/` til `/mnt/new-disk/`.

## Synkstrategi

Se `previews.md` for synkronisering av database og coldpreview.

For originalfiler:
- Brukeren er ansvarlig for backup og synk av originaler
- Systemet validerer kun at filstiene er tilgjengelige
- Ved synk mellom maskiner: oppdater filstier hvis originalene ligger på annen sti på ny maskin
