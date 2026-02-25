# Domenebegreper

Denne filen er den autoritative kilden til terminologi i Hotprevue. Ved tvil om hva et begrep betyr: les her.

---

## Bilde

Den grunnleggende enheten i systemet. Et bilde representerer én originalfil. Systemet lagrer metadata og forhåndsvisninger — ikke selve filen.

## Registrering

Prosessen der et bilde legges inn i systemet. Aldri kalt "import". Registrering leses, eksif trekkes ut, previews genereres — originalen røres ikke.

## Fotograf

En person som har tatt ett eller flere bilder i systemet. Ikke en systembruker — ingen innlogging eller tilgangskontroll. Eieren av systemet administrerer fotograflisten på vegne av alle. Hvert bilde må ha én fotograf (aldri null). Systemet har alltid én standardfotograf (`is_default`) og én plassholder for ukjent fotograf (`is_unknown`).

Fotograf settes automatisk ved registrering basert på input-sesjonen, men kan korrigeres i etterkant på enkeltbilder eller i batch.

## Input-sesjon

En navngitt registreringskjøring — f.eks. "Kjells iPhone" eller "Familiekamera SD-kort". Kombinerer kildeaspektet (hvem sitt utstyr, hvilken kilde) med hendelseaspektet (én konkret kjøring med tidspunkt og filsti). Alle bilder registrert i en sesjon knyttes til den. Gir sporbarhet og mulighet for å filtrere eller angre en hel batch.

Input-sesjonen har en standardfotograf: bilder registrert via sesjonen får denne fotografen som standardverdi, med mindre noe annet er angitt.

## Hothash

SHA256 av hotpreview-JPEG-bytene. Brukes som unik ID for et bilde i hele systemet.

## Hotpreview

150×150 px JPEG, base64-kodet, lagret direkte i databasen. Brukes til rask visning i gallerier uten diskaksess.

## Coldpreview

Opptil 1200 px JPEG, lagret på disk i en hash-basert katalogstruktur (`$COLDPREVIEW_DIR/<ab>/<cd>/<hothash>.jpg`). Brukes til detaljvisning. Kan alltid regenereres fra originalfilen.

## Stack

En visuell gruppering av flere bilder av samme motiv. Én stack vises som ett bilde (coverbilde) i galleriet, men kan ekspanderes. Stack har ingen egne metadata — all informasjon ligger på enkeltbildene. Implementert via `stack_id` på bilde-entiteten. Ett bilde er markert som `is_stack_cover`.

## Event

En uordnet gruppe bilder knyttet til en hendelse, et tidspunkt eller et sted. Hvert bilde tilhører maksimalt én event (one-to-many). Events støtter hierarki (parent/child). Ingen rekkefølge på bildene — alle er likestilte.

## Collection

En ordnet gruppe bilder der rekkefølgen er viktig. Hvert bilde kan ha en bildetekst (caption). Tekstkort kan legges inn mellom bilder. Mange-til-mange: ett bilde kan inngå i flere collections. Brukes til lysbildeserier, porteføljer, leveranser og kuratering.

## Story (PhotoText)

En blokk-basert artikkel som kombinerer bilder og tekst. Lar brukeren fortelle en historie rundt bildene.

## Companion files

Tilknyttede filer til et bilde — f.eks. RAW, JPEG, XMP, sidecar. Lagres som en liste per bilde med type og filsti.

## Korreksjon

Ikke-destruktiv endring av bilde-metadata: tid, sted, rotasjon, eksponering. Lagres separat fra originaldata og EXIF.
