# Domenebegreper

Denne filen er den autoritative kilden til terminologi i Hotprevue. Ved tvil om hva et begrep betyr: les her.

---

## Photo

Den grunnleggende enheten i systemet. Et Photo representerer ett logisk fotografi — ett opptak, én kreativ enhet. Det som vises i galleriet, knyttes til events og collections, og får rating og beskrivelse. Et Photo kan ha én eller flere tilknyttede originalfiler (se ImageFile).

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

En uordnet gruppe Photos knyttet til en hendelse, et tidspunkt eller et sted. Hvert Photo tilhører maksimalt én event (one-to-many). Ingen rekkefølge på Photos — alle er likestilte.

**Hierarki:** Events støtter ett nivå nesting — en rot-event kan ha child-events, men en child-event kan ikke ha egne children. Hierarkiet er rent organisatorisk: Photos knyttes alltid direkte til én event, og arver ingen tilhørighet oppover. `photo_count` er alltid kun direkte tilknyttede Photos.

**Sletting:** `DELETE /events/{id}` avvises med feil hvis eventen har child-events. Brukeren må slette children manuelt først. Photos som tilhørte eventen beholdes — `event_id` settes til `null`.

**Flytte:** En event kan flyttes ved å endre `parent_id` via `PATCH`. En rot-event med children kan ikke gjøres om til child-event — det ville gitt tre nivåer. En child-event kan løsrives til rot-event ved å sette `parent_id` til `null`.

**Navn:** Ingen unik constraint — brukeren bestemmer selv.

## Collection

En ordnet gruppe Photos der rekkefølgen er viktig. Mange-til-mange: ett Photo kan inngå i flere collections. Brukes til lysbildeserier, porteføljer, leveranser og kuratering.

**Rekkefølge:** Hvert CollectionItem har en heltallsposisjon. Rekkefølge endres via `PUT /collections/{id}/items` som tar inn en sortert liste av item-IDer og oppdaterer kun `position` — innhold røres ikke. Ingen unik constraint på `position`.

**CollectionItem:** En selvstendig entitet med egen UUID. Innholdsendringer (caption, title, text_content) skjer via `PATCH /collections/{id}/items/{item_id}`. Item-IDer er stabile og endres ikke ved resortering.

**Tekstkort:** Et CollectionItem uten tilknyttet Photo. Har `title` og `text_content` — vises som en visuell slide i collection. Kan brukes til å sette kontekst mellom bilder.

**Coverbilde:** Se felles coverbilde-regel nedenfor. Cover settes via `PATCH /collections/{id}` (`cover_hothash`).

## Coverbilde

Felles regel for alle modeller med coverbilde (Stack, Event, Collection):

1. Hvis et eksplisitt coverbilde er satt og Photo er aktivt — bruk det.
2. Hvis coverbilde er mykt slettet — vis det med "slettet"-indikator. Brukeren velger nytt.
3. Hvis ingen eksplisitt cover er satt — bruk første Photo etter modellens naturlige rekkefølge.
4. Ved `empty-trash`: hvis cover-Photo hard-slettes, nullstilles `cover_hothash` automatisk og fallback-regelen trer i kraft.

| Modell | Cover lagret som | Fallback-rekkefølge |
|---|---|---|
| Stack | `is_stack_cover` på Photo | Registreringsrekkefølge |
| Event | `cover_hothash` på Event | `taken_at ASC` |
| Collection | `cover_hothash` på Collection | `position ASC` |

Stack skiller seg fra de andre ved at `is_stack_cover` alltid auto-settes (ved opprettelse og ved fjerning av cover). Event og Collection holder `cover_hothash` nullable — brukeren setter det manuelt.

## Soft delete

Photos slettes ikke direkte fra databasen. `DELETE /photos/{hothash}` setter `deleted_at = now()` — Photo er fortsatt i databasen men filtreres ut fra alle visninger som standard.

- `POST /photos/{hothash}/restore` — gjenoppretter et mykt slettet Photo (`deleted_at = null`)
- `POST /photos/empty-trash` — hard-sletter alle Photos med `deleted_at` satt, inkludert coldpreview-filer på disk

**Re-registrering:** Hvis en fil med samme hothash som et mykt slettet Photo skannes på nytt, gjenopprettes Photo stille (`deleted_at = null`) uten duplikatvarsel.

## Story (PhotoText)

En blokk-basert artikkel som kombinerer Photos og tekst. Lar brukeren fortelle en historie rundt bildene.

## Korreksjon

Ikke-destruktiv endring av Photo-metadata: tid, sted, rotasjon, eksponering. Lagres separat fra originaldata og EXIF.
