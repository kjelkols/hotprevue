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

En navngitt registreringskjøring som kombinerer kildeaspektet (hvem sitt utstyr, hvilken kilde) med hendelsesaspektet (én konkret kjøring med tidspunkt og filsti). Eksempler: "Kjells iPhone", "Familiekamera SD-kort", "Arkiv 1990–2000".

Alle Photos registrert i en sesjon knyttes til den og kan alltid søkes ut via `input_session_id`. Sesjonen er et organisatorisk ankerpunkt — Photos behøver ikke ha event ved registrering.

**Standardverdier:** Sesjonen har en obligatorisk standardfotograf (`default_photographer_id`) og et valgfritt standardevent (`default_event_id`). Photos arver disse som standardverdier. Begge kan overstyres per Photo i etterkant.

**Event-tilknytning:** To alternativer — ingen event (`default_event_id` er null) eller ett spesifikt event (satt av brukeren). Automatisk event-generering fra katalogstruktur er et frontend-ansvar og skjer ikke i backend.

**Rekursiv skanning:** Styres av `recursive`-flagget (standard: true). Kan deaktiveres hvis brukeren kun vil skanne toppnivåkatalogen.

**Status:** Sesjonen har en livssyklus: `pending` → `scanning` → `awaiting_confirmation` → `processing` → `completed`. Ved feil settes status til `failed`. `awaiting_confirmation` betyr at scan er utført og systemet venter på at brukeren bekrefter prosessering.

**Rescan:** En sesjon kan rescanned mot samme `source_path` uavhengig av tidligere status. Filer med hothash som allerede finnes i databasen hoppes over stille. Nye filer registreres og telles i `photo_count`.

**Duplikater:** Filer med hothash som matcher et eksisterende Photo, men med en ny ukjent filsti, registreres i `DuplicateFile`-tabellen og telles i `duplicate_count`.

**Feil:** Filer som feiler under prosessering logges i `SessionError`-tabellen og telles i `error_count`.

## DuplicateFile

Et register over filer oppdaget under skanning som har identisk hothash som et eksisterende Photo, men en ukjent filsti. Indikerer at samme bilde finnes på flere steder i filsystemet — en uønsket tilstand brukeren bør rydde opp i.

Backend registrerer duplikater passivt under skanning. Ingen statuslogikk, ingen arbeidsflyt i backend. Frontend presenterer listen og gir brukeren informasjonen som trengs for å handle utenfor systemet. Hotprevue sletter eller flytter aldri filer.

En DuplicateFile-rad fjernes stille fra databasen når filen ikke lenger finnes på disk — oppdaget under neste skanning av samme katalog eller ved manuell filsti-validering. Cascade-slettes når tilhørende Photo slettes.

Unik constraint på `file_path`: samme fil registreres aldri to ganger som duplikat, uavhengig av hvilken sesjon som finner den.

## SessionError

En logg over filer som feilet under prosessering i en InputSession — f.eks. ulesbare filer, ødelagte bildefiler eller manglende lesetilgang. Gir sporbarhet for problemer brukeren bør undersøke.

Cascade-slettes når sesjonen de tilhører slettes.

## Hothash

SHA256 av hotpreview-JPEG-bytene. Brukes som unik ID for et Photo i hele systemet — i databasen, i API-et og i filstier for coldpreviews. Hothash er uforanderlig etter registrering.

## Hotpreview

150×150 px JPEG, base64-kodet, lagret direkte i databasen. Generert fra masterfilens innhold ved registrering. Brukes til rask visning i gallerier uten diskaksess.

## Coldpreview

Opptil 1200 px JPEG, lagret på disk i en hash-basert katalogstruktur (`$COLDPREVIEW_DIR/<ab>/<cd>/<hothash>.jpg`). Brukes til detaljvisning. Kan regenereres fra masterfilens originalfil hvis den er tilgjengelig.

## Stack

En visuell gruppering av flere Photos av samme motiv. Én stack vises som ett Photo (coverbilde) i galleriet, men kan ekspanderes. Stack har ingen egne metadata — all informasjon ligger på enkelt-Photos. Implementert via `stack_id` på Photo-entiteten.

**Coverbilde:** Alltid eksakt ett Photo per stack er markert som `is_stack_cover`. Coverbilde settes automatisk til det første Photo ved opprettelse. Hvis coverbilde fjernes fra stacken, settes det første gjenværende Photo automatisk som nytt coverbilde.

**Eksklusivt medlemskap:** Et Photo kan kun tilhøre én stack. Forsøk på å legge et Photo som allerede er i en annen stack inn i en ny stack avvises med feil.

**Levetid:** En stack opprettes alltid med minst ett Photo. Hvis siste Photo fjernes fra en stack, slettes stacken automatisk (`stack_id` settes til `null` på alle gjenværende Photos). En stack kan også slettes eksplisitt — da løses alle Photos fra stacken.

## Event

En uordnet gruppe Photos knyttet til en hendelse, et tidspunkt eller et sted. Hvert Photo tilhører maksimalt én event (one-to-many). Events støtter hierarki (parent/child). Ingen rekkefølge på Photos — alle er likestilte.

## Collection

En ordnet gruppe Photos der rekkefølgen er viktig. Hvert Photo kan ha en bildetekst (caption). Tekstkort kan legges inn mellom Photos. Mange-til-mange: ett Photo kan inngå i flere collections. Brukes til lysbildeserier, porteføljer, leveranser og kuratering.

## Story (PhotoText)

En blokk-basert artikkel som kombinerer Photos og tekst. Lar brukeren fortelle en historie rundt bildene.

## Korreksjon

Ikke-destruktiv endring av Photo-metadata: tid, sted, rotasjon, eksponering. Lagres separat fra originaldata og EXIF.
