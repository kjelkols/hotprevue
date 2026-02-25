# 001 — Hothash som unik bilde-ID

## Status

Godkjent

## Kontekst

Bilder i Hotprevue registreres fra vilkårlige filstier på brukerens maskin. Originalfiler kan flyttes, omdøpes eller eksistere på ulike stier på ulike maskiner. En databasegenerert sekvensiell ID er ikke stabil på tvers av installasjoner og gir ingen mening utenfor én enkelt database.

## Beslutning

SHA256-hashen av hotpreview-JPEG-bytene brukes som unik ID (`hothash`) for hvert bilde i hele systemet — i databasen, i API-et og i filstier for coldpreviews.

## Begrunnelse

- **Innholdsbasert:** To registreringer av identisk bilde gir identisk hothash → naturlig duplikatdeteksjon
- **Stabil på tvers av installasjoner:** Samme bilde gir samme hothash uavhengig av maskin
- **Selvdokumenterende filstruktur:** Coldpreview-stier (`ab/cd/abcd1234...jpg`) er direkte avledet av hothash
- **Ingen ekstern avhengighet:** Krever ingen UUID-generator eller sentral ID-tjeneste

## Konsekvenser

- Hothash endres hvis hotpreview regenereres (endret algoritme, kompresjon, o.l.) → behandles som nytt bilde
- SHA256 av en 150×150 JPEG gir tilstrekkelig entropi — kollisjoner er praktisk talt umulig
- EXIF-basert hash (f.eks. hash av originalbytes) ble vurdert, men avvist fordi originalen ikke alltid er tilgjengelig ved visning
