# Domenebegreper

Denne filen er den autoritative kilden til terminologi i Hotprevue. Ved tvil om hva et begrep betyr: les her.

---

## Photo

Den grunnleggende enheten i systemet. Et Photo representerer ett logisk fotografi — ett opptak, én kreativ enhet. Det som vises i galleriet, knyttes til events og collections, og får rating, tags og beskrivelse. Et Photo kan ha én eller flere tilknyttede originalfiler (se ImageFile).

## ImageFile

En fysisk fil på disk tilknyttet et Photo. Et Photo har alltid minst én ImageFile. ImageFile er en ren filpeker — den brukes til å finne originalfiler og gjøre dem tilgjengelige for eksterne programmer. Den har ingen egen hotpreview eller EXIF.

Én ImageFile er master: den filen som ble brukt som kilde for Photo sin hotpreview og EXIF ved registrering. Mastervalget er permanent og kan ikke endres etter registrering.

Filtyper som lagres: `RAW`, `JPEG`, `TIFF`, `PNG`, `HEIC`, `XMP`. XMP-sidecar-filer registreres som ImageFile med `file_type = "XMP"` — innholdet leses ikke, men filstien bevares slik at eksterne programmer (f.eks. Lightroom, Darktable) kan bruke dem.

## Registrering

Prosessen der bilder legges inn i systemet. Aldri kalt "import". Backend leser originalfiler, trekker ut EXIF, genererer hotpreview og coldpreview — originalfilene røres ikke.

## Fotograf

En person som har tatt ett eller flere Photos i systemet. Ikke en systembruker — ingen innlogging eller tilgangskontroll. Eieren av systemet administrerer fotograflisten på vegne av alle. Hvert Photo må ha én fotograf (aldri null). Systemet har alltid én standardfotograf (`is_default`) og én plassholder for ukjent fotograf (`is_unknown`).

Fotograf settes automatisk ved registrering basert på input-sesjonen, men kan korrigeres i etterkant på enkeltbilder eller i batch.

Feltene `name`, `website` og `bio` er de som publiseres til Hotprevue Global. `notes` er intern og publiseres aldri.

## Input-sesjon

En navngitt registreringskjøring — f.eks. "Kjells iPhone" eller "Familiekamera SD-kort". Kombinerer kildeaspektet (hvem sitt utstyr, hvilken kilde) med hendelsesaspektet (én konkret kjøring med tidspunkt og filsti). Alle Photos registrert i en sesjon knyttes til den. Gir sporbarhet og mulighet for å filtrere eller angre en hel batch.

Input-sesjonen har en standardfotograf: Photos registrert via sesjonen får denne fotografen som standardverdi.

## Hothash

SHA256 av hotpreview-JPEG-bytene. Brukes som unik ID for et Photo i hele systemet — i databasen, i API-et og i filstier for coldpreviews. Hothash er uforanderlig etter registrering.

## Hotpreview

150×150 px JPEG, base64-kodet, lagret direkte i databasen. Generert fra masterfilens innhold ved registrering. Brukes til rask visning i gallerier uten diskaksess.

## Coldpreview

Opptil 1200 px JPEG, lagret på disk i en hash-basert katalogstruktur (`$COLDPREVIEW_DIR/<ab>/<cd>/<hothash>.jpg`). Brukes til detaljvisning. Kan regenereres fra masterfilens originalfil hvis den er tilgjengelig.

## Stack

En visuell gruppering av flere Photos av samme motiv. Én stack vises som ett Photo (coverbilde) i galleriet, men kan ekspanderes. Stack har ingen egne metadata — all informasjon ligger på enkelt-Photos. Implementert via `stack_id` på Photo-entiteten. Ett Photo er markert som `is_stack_cover`.

## Event

En uordnet gruppe Photos knyttet til en hendelse, et tidspunkt eller et sted. Hvert Photo tilhører maksimalt én event (one-to-many). Events støtter hierarki (parent/child). Ingen rekkefølge på Photos — alle er likestilte.

## Collection

En ordnet gruppe Photos der rekkefølgen er viktig. Hvert Photo kan ha en bildetekst (caption). Tekstkort kan legges inn mellom Photos. Mange-til-mange: ett Photo kan inngå i flere collections. Brukes til lysbildeserier, porteføljer, leveranser og kuratering.

## Story (PhotoText)

En blokk-basert artikkel som kombinerer Photos og tekst. Lar brukeren fortelle en historie rundt bildene.

## Korreksjon

Ikke-destruktiv endring av Photo-metadata: tid, sted, rotasjon, eksponering. Lagres separat fra originaldata og EXIF.
