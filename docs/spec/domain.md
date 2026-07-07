# Domenebegreper

Denne filen er den autoritative kilden til terminologi i Hotprevue. Ved tvil om hva et begrep betyr: les her.

---

## Terminologioversikt

| Norsk | Engelsk (kode) | Komponent | Beskrivelse |
|---|---|---|---|
| Utvalg | `Browse` | `BrowseView` | Spørringsbasert, ikke-sekvensiell bildeliste. Grunnlag for avkryssingstilstand og batch-operasjoner. |
| Kolleksjonsvisning | `Collection` | `CollectionView` | Kuratert, ordnet sekvens av CollectionItems. Caption, tekstkort. |
| Lysbord | `Tray` | `SelectionTray` | Overlegg nederst i vinduet med avkryssede bilder og handlinger. Vises når utvalget er ikke-tomt. **NB:** «Lightbox» brukes ikke — det betyr fullskjermvisning av ett bilde i webprogrammering. |
| Avkryssingstilstand | `Selection` | `useSelectionStore` | Hvilke photos er avkrysset. Deles mellom BrowseView og SelectionTray. Intern tilstand, ikke et domeneobjekt. |
| Kontekstmeny | `ContextMenu` | `useContextMenuStore` + `ContextMenuOverlay` | Flytende meny utløst av høyreklikk. Innholdet avhenger av seleksjonstilstand og hva som ble høyreklikket. Globalt system — se `context-menu.md`. |
| Hjem | `Home` | `HomePage` | Startside med statistikk, snarveier og bildemosaikk. |
| Toppmeny | `TopNav` | `TopNav` | Persistent navigasjonslinje med primærlenker og nedtrekksgrupper. |

**«Gallery» brukes ikke** — verken i UI-tekst, komponentnavn eller kode.
**«Import» brukes ikke** — bilder *registreres*, de importeres aldri.

---

## Photo

Den grunnleggende enheten i systemet. Et Photo representerer ett logisk fotografi — ett opptak, én kreativ enhet. Knyttes til events, collections, tags, kind og fotograf, og får rating. Et Photo kan ha én eller flere tilknyttede originalfiler (se ImageFile).

## ImageFile

En fysisk fil på disk tilknyttet et Photo. Et Photo har alltid minst én ImageFile. ImageFile er en ren filpeker — den brukes til å finne originalfiler og gjøre dem tilgjengelige for eksterne programmer. Den har ingen egen hotpreview eller EXIF.

Én ImageFile er master: den filen som ble brukt som kilde for Photo sin hotpreview og EXIF ved registrering. Mastervalget er permanent og kan ikke endres etter registrering.

Filtyper som lagres: `RAW`, `JPEG`, `TIFF`, `PNG`, `HEIC`, `XMP`. XMP-sidecar-filer registreres som ImageFile med `file_type = "XMP"` — innholdet leses ikke, men filstien bevares slik at eksterne programmer (f.eks. Lightroom, Darktable) kan bruke dem.

## Registrering

Prosessen der bilder legges inn i systemet. Aldri kalt «import». Agenten (lokalt Python-program med filsystemtilgang) skanner katalogen, leser filene, trekker ut EXIF og genererer previews; frontend orkestrerer og sender resultatene som JSON (base64-previews) til backend. Backend leser aldri originalfiler (ADR-008/024).

## Fotograf

En person som har tatt ett eller flere Photos — og samtidig systemets brukeridentitet (ADR-044). Hver fotograf har et tilgangsnivå: `owner` (full tilgang, inkl. administrasjon) eller `guest` (ser eget innhold og det som er delt). Hvert Photo må ha én fotograf (aldri null). Systemet har alltid én standardfotograf (`is_default`) og én plassholder for ukjent fotograf (`is_unknown`).

Fotograf settes automatisk ved registrering basert på maskinen/sesjonen, men kan korrigeres i etterkant på enkeltbilder eller i batch.

Feltene `name`, `website` og `bio` er offentlige (deling); `notes` er intern og publiseres aldri.

## Maskin

Hver klientinstallasjon er en registrert maskin (`machines`-tabellen) med nøyaktig én fotograf (ADR-011). `photos.registered_by_machine_id` sporer hvilken maskin som registrerte et bilde. Maskiner autentiseres med API-token (`machine_tokens`, hash lagret) utstedt ved innrullering med invitasjonskode (`machine_invite_codes`, ADR-040). Maskinen har egne innstillinger (JSONB) og katalogsnarveier.

**Identitetsvalg i nettleser (ADR-012):** en nettleser uten Python-klient velger fotografidentitet fra en liste; valget persisteres i `localStorage` og kreves for skriveoperasjoner.

## Input-sesjon

En navngitt registreringskjøring som kombinerer kildeaspektet (hvem sitt utstyr, hvilken kilde) med hendelsesaspektet (én konkret kjøring med tidspunkt og filsti). Eksempler: "Kjells iPhone", "Familiekamera SD-kort", "Arkiv 1990–2000".

Alle Photos registrert i en sesjon knyttes til den og kan alltid søkes ut via `input_session_id`. Sesjonen er et organisatorisk ankerpunkt — Photos behøver ikke ha event ved registrering, men registreringsflyten kan sette `event_id` per gruppe basert på katalogkartet (ADR-024).

**Standardverdier:** Sesjonen har en obligatorisk standardfotograf (`default_photographer_id`) og et valgfritt standardevent (`default_event_id`). Photos arver disse som standardverdier. Begge kan overstyres per Photo.

**Status:** `pending` (opprettet, ingen grupper mottatt) → `uploading` (første gruppe registrert) → `completed` (`/complete` er kalt).

**Duplikater:** Filer med hothash som matcher et eksisterende Photo, men med en ny ukjent filsti, registreres i `DuplicateFile`-tabellen og telles i `duplicate_count`.

**Feil:** Filer som feiler under prosessering logges i `SessionError`-tabellen og telles i `error_count`.

## DuplicateFile

Et register over filer oppdaget under skanning som har identisk hothash som et eksisterende Photo, men en ukjent filsti. Indikerer at samme bilde finnes på flere steder i filsystemet — en uønsket tilstand brukeren bør rydde opp i. Hotprevue sletter eller flytter aldri filer på egen hånd.

Unik constraint på `file_path`: samme fil registreres aldri to ganger som duplikat. Cascade-slettes når tilhørende Photo slettes.

## SessionError

En logg over filer som feilet under prosessering i en InputSession — f.eks. ulesbare filer, ødelagte bildefiler eller manglende lesetilgang. Cascade-slettes med sesjonen.

## Hothash

SHA256 av hotpreview-JPEG-bytene. Brukes som unik ID for et Photo i hele systemet — i databasen, i API-et og i filstier for coldpreviews. Hothash er uforanderlig etter registrering.

## Hotpreview

150×150 px JPEG, base64-kodet, lagret direkte i databasen. Generert fra masterfilens innhold ved registrering. Brukes til rask visning i grids uten diskaksess.

## Coldpreview

Opptil 1200 px JPEG, lagret på disk i en hash-basert katalogstruktur (`<ab>/<cd>/<hothash>.jpg`). Brukes til detaljvisning. Kan regenereres fra masterfilens originalfil hvis den er tilgjengelig.

## Kind (ADR-034)

Gjensidig utelukkende klassifikasjon av Photos etter *hva slags bilde det er* — f.eks. «Foto», «Skjermbilde», «Dokument», «Skannet». Hvert Photo har nøyaktig én kind (`kind_id`, aldri null; ny-registrerte får standard-kind). Kind har farge, sorteringsrekkefølge og `hidden_by_default` — KindFilterBar i frontend lar brukeren skjule kinds fra visningene, med tydelig indikator når noe er skjult.

## Tags (ADR-035)

Fritekstetiketter på Photos — f.eks. `solnedgang`, `fjell`, `familie`. Mange-til-mange via `tags`- og `photo_tags`-tabellene, med slug og trigram-likhetsøk ved oppretting (foreslår eksisterende lignende tags). Forvaltnings-UI med omdøping og sammenslåing. Tags er et søkeverktøy på tvers av alle andre organiseringsmekanismer.

## Category (legacy)

Eldre klassifikasjonsmekanisme (`category_id`, nullable, med `excluded_from_stream`). Tabellen og filtreringen finnes fortsatt, men det er ikke lenger noe forvaltnings-API — Kind (ADR-034) har overtatt rollen. Ikke bygg ny funksjonalitet på Category.

## Stack

En visuell gruppering av flere Photos av samme motiv. Én stack vises som ett Photo (coverbilde) i gridet, men kan ekspanderes. Stack har ingen egne metadata — all informasjon ligger på enkelt-Photos (`stack_id` + `is_stack_cover`).

**Coverbilde:** Alltid eksakt ett Photo per stack er `is_stack_cover`. Settes automatisk ved opprettelse; hvis coveret fjernes fra stacken, promoteres første gjenværende Photo.

**Eksklusivt medlemskap:** Et Photo kan kun tilhøre én stack.

**Levetid:** Hvis siste Photo fjernes, slettes stacken. En stack kan også oppløses eksplisitt — alle Photos løses fra den.

## Event

En uordnet gruppe Photos knyttet til en hendelse, et tidspunkt eller et sted. Hvert Photo tilhører maksimalt én event (one-to-many).

**Hierarki:** Ett nivå nesting — en rot-event kan ha child-events, en child kan ikke ha egne children. Photos knyttes alltid direkte til én event; `photo_count` teller kun direkte tilknyttede.

**Sletting:** Avvises hvis eventen har children. Photos beholdes — `event_id` settes til `null`.

**Flytte:** `parent_id` endres via `PATCH`. En rot-event med children kan ikke bli child (tre nivåer); en child kan løsrives med `parent_id = null`.

## Collection

En ordnet gruppe Photos der rekkefølgen er viktig. Mange-til-mange: ett Photo kan inngå i flere collections. Brukes til lysbildeserier, porteføljer, leveranser og kuratering.

**Rekkefølge:** Hvert CollectionItem har en heltallsposisjon. Rekkefølge endres via `PUT /collections/{id}/items` med sortert item-ID-liste — innhold røres ikke.

**CollectionItem:** Selvstendig entitet med egen UUID og stabil ID. Enten et foto-element (`hothash`) eller et tekstkort (`text_item_id`) — aldri begge.

**Tekstkort (TextItem):** Markdown-innhold som vises som egen slide. Kan settes inn mellom bilder for kontekst.

**Presentasjon:** `/collections/:id/present` kjører kolleksjonen som lysbildefremvisning (se `collection-presentation.md`).

## Coverbilde

Felles regel for modeller med coverbilde (Stack, Event, Collection):

1. Hvis et eksplisitt coverbilde er satt og Photo er aktivt — bruk det.
2. Hvis ingen eksplisitt cover er satt — bruk første Photo etter modellens naturlige rekkefølge.
3. Ved `empty-trash`: hvis cover-Photo hard-slettes, nullstilles `cover_hothash` og fallback-regelen trer i kraft.

| Modell | Cover lagret som | Fallback-rekkefølge |
|---|---|---|
| Stack | `is_stack_cover` på Photo | Registreringsrekkefølge |
| Event | `cover_hothash` på Event | `taken_at ASC` |
| Collection | `cover_hothash` på Collection | `position ASC` |

## Soft delete

Photos slettes ikke direkte. `POST /photos/{hothash}/delete` setter `deleted_at = now()` — Photo er fortsatt i databasen men filtreres ut fra alle visninger som standard.

- `POST /photos/{hothash}/restore` — gjenoppretter (`deleted_at = null`)
- `POST /photos/empty-trash` — hard-sletter alle med `deleted_at` satt, inkludert coldpreview-filer på disk

**Re-registrering:** En fil med samme hothash som et mykt slettet Photo gjenoppretter det stille ved ny skanning.

## To verdener: organisering og presentasjon

Hotprevue skiller mellom to fundamentalt ulike kontekster. Å forstå dette skillet er avgjørende for å forstå systemets logikk.

| | Organisering (BrowseView) | Presentasjon (CollectionView) |
|---|---|---|
| **Formål** | Sortere, klassifisere, rydde metadata | Kuratere og fremføre et ferdig produkt |
| **Innhold** | Spørringsresultat — bestemmes av filtre | Eksplisitt utvalgt og ordnet av brukeren |
| **Rekkefølge** | Automatisk (dato, rating o.l.) | Manuell — brukerdefinert og meningsfull |
| **Elementtype** | Photos uten presentasjonsattributter | CollectionItems: foto eller tekstkort |
| **Operasjoner** | Sett event/kind/tag/fotograf, vurder, slett | Reorder, caption, tekstkort, fjern fra samling |
| **Avkryssingstilstand** | Ja — for batch-operasjoner | Nei |
| **Kan være kilde** | Ja | **Aldri** |

**Collection er et sluttprodukt**, ikke et arbeidsverktøy for metadata-organisering. Den bygges *av* organiserte bilder og er destinasjonen for kuratering — aldri kilden.

## SelectionTray (Lysbord)

Overlegg nederst i vinduet som viser avkryssede bilder med handlingsknapper (tildeling m.m.). Vises automatisk når utvalget er ikke-tomt; SelectionModal gir full oversikt. Analogt med et fysisk lysbord der fotografen legger ut dias for å sammenligne og velge. Se `selection-tray.md`.

**NB:** «Lightbox» brukes ikke — det betyr fullskjermvisning av ett bilde i webprogrammering og må ikke blandes med Lysbord.

## Korreksjon

To typer korreksjon i systemet:

### Visningskorreksjon (ADR-028)

Rotasjon, speiling, horisont, eksponering og crop. Lagres i `PhotoCorrection`-tabellen (kun Photos som har korreksjoner). Originalfil og coldpreview på disk røres aldri:

- **Coldpreview:** korreksjonen appliseres **på-farten** når `GET /photos/{hothash}/coldpreview` serveres (rotation → flip → horisont → crop → eksponering). Ingen korrigert fil lagres.
- **Hotpreview:** immutabel (hothash!). Rotasjon/flip er denormalisert til liste-responsen og appliseres som CSS-transform i frontend.

`PATCH /photos/{hothash}/correction` oppdaterer delvis; `DELETE` fjerner hele korreksjonen.

### Metadata-korreksjon (ADR-043)

Brukerkorrigering av `taken_at` og posisjon — de to feltene som oftest trenger justering (feil kameraklokke, manglende GPS, skannede bilder). Verdien lagres direkte i Photo-feltene; original-EXIF er alltid bevart i `exif_data`. Hver endring logges i `PhotoFieldEdit` (gammel/ny verdi, metode, maskin, tidspunkt) — full provenans.

**`taken_at_source` og `location_source`:**

| Verdi | Betydning |
|---|---|
| `0` | Fra EXIF — original, uendret |
| `1` | Justert fra EXIF — f.eks. tidsoffset lagt til |
| `2` | Satt manuelt — ingen EXIF-kilde |

**`taken_at_accuracy`:** `second` / `hour` / `day` / `month` / `year` — styrer hvordan tidspunktet vises («Juni 2023», «1975»).

**`location_accuracy`:** `exact` (<50 m) / `street` / `city` / `region` / `country` (+ `location_accuracy_meters`) — styrer kartvisning: presis pin ved `exact`, uskarpt område ved `city`, bare stedsnavn ved `region`/`country`.

## Kvalitetsmetrikker (ADR-021)

Beregnes av agenten fra originalfilen ved registrering: `sharpness_score`, `exposure_mean`, `exposure_clipping`, `noise_score`. Brukes som søkekriterier.

## Deling (ADR-045)

Et Photo kan deles: internt (visningsside med caption) og offentlig via relay-tjenesten (`public_share_token` + utløpsdato). Nedlasting av original går via backend som proxy mot maskinen som har filen.

## SystemSettings

Én enkelt rad i databasen som representerer global systemkonfigurasjon. Opprettes automatisk ved første oppstart.

**Installasjons-ID:** En UUID som genereres én gang og aldri endres. ID-en tilhører *arkivet*, ikke maskinen.

**Eierinfo** (`owner_name`, `owner_website`, `owner_bio`, `instance_name`): avsenderidentitet på installasjonsnivå — bevisst adskilt fra Photographer (kreativ attribuering per foto).

**Visnings- og previewinnstillinger:** `default_sort`, `show_deleted_in_gallery`, `browse_buffer_size`, `coldpreview_max_px` (1200), `coldpreview_quality` (85). Coldpreviews er statiske etter generering.

**Deling:** relay-URL, base-URL, API-nøkkel og standard TTL for offentlige lenker (ADR-045).

**Maskininnstillinger:** innstillinger som er per maskin (ikke per installasjon) lagres i `machines.settings` (JSONB) og endres via `PATCH /settings/machine`.
