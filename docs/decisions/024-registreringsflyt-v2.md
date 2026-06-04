# ADR-024: Registreringsflyt v2 — multi-event, katalogkart og gjenskan

**Status:** Forslag  
**Dato:** 2026-06-04  
**Grunnlag:** `docs/drafts/event-fra-katalogsti.md`, `docs/drafts/gjenskan-og-reorganisering.md`

---

## Kontekst

Registreringsflyten har tre innbyrdes relaterte mangler:

**1. Én event per økt er for lite.** Brukere organiserer bilder i kataloger
der katalognavnet er eventet. En skan av `/Bilder/2024/` med 12 underkataloger
bør produsere 12 events. Nåværende løsning tvinger brukeren til enten å skanne
12 ganger, velge ett felles event for alt, eller tildele events manuelt etterpå.

**2. Eventvelgeren er feil abstraksjonsplan.** `EventSection` ber brukeren om
å velge et eksisterende event eller skrive inn et nytt navn. Problemene:
- Administrasjon av events hører hjemme på EventPage, ikke i registrering.
- Å velge ett eksisterende event for en ny skan er sjelden riktig — brukeren
  registrerer nye bilder, ikke tilleggsbilder til noe de allerede vet om.
- Det finnes ingen mekanisme for å utlede eventnavn fra mappenavn.

**3. Session opprettes for tidlig.** I dag kjøres `createSession()` *før*
`check_hothashes` — altså før systemet vet om det finnes noe nytt å registrere.
En utilsiktet gjenskan av en allerede-registrert katalog produserer en session
med `photo_count=0` og ingen bilder. Disse sesjonene er støy i historikken.

Teknisk henger problem 3 sammen med at `check_hothashes` krever en `session_id`
i dag, noe som tvinger frem tidlig sesjonsoppretting.

---

## Beslutning

### 1. check-hothashes blir sesjonsuvhengig

Nytt backend-endepunkt:

```
POST /photos/check-hothashes
Body:     { hothashes: string[] }
Response: { known: string[], unknown: string[] }
```

Eksisterende `POST /input-sessions/{id}/check-hothashes` **beholdes** for
bakoverkompatibilitet, men delegerer nå til den samme logikken uten at
session_id brukes i selve sjekken.

### 2. Ny registreringsflyt

Klientflyten omstruktureres slik at sesjonen opprettes etter brukerbekreftelse,
ikke før:

```
Steg A — Analyse (ingen sesjon finnes ennå)
  1. scanDirectory(path, recursive)          → FileGroup[]
  2. hashFile(group) × N                    → hothash per gruppe
  3. POST /photos/check-hothashes           → known[], unknown[]
  4. Vis katalogkart (se nedenfor)
  5. Bruker bekrefter — eller avbryter uten spor

Steg B — Registrering (sesjon opprettes nå)
  6. POST /input-sessions                   → session_id
  7. POST /input-sessions/{id}/groups × M  → kun unknown-grupper
     (hver gruppe bærer event_id fra katalogkartet)
  8. POST /input-sessions/{id}/complete
```

**Konsekvens for "alle er duplikater"-tilfellet:** Etter steg 3 er
`unknown.length === 0`. Katalogkartet vises ikke. Brukeren ser:
> "Alle N bilder i denne katalogen er allerede registrert. Ingen ny
> registreringsøkt ble opprettet."

Det finnes ingen knapp for å fortsette — det er ingenting å gjøre.

**Konsekvens for "delvis ny":** Katalogkartet vises med kolonnen "Ny"
som viser antall nye bilder per underkatalog. Kataloger uten nye bilder
vises i nedtonet stil, men er med i kartet for oversiktens skyld.

### 3. Katalogkart — detect-and-confirm

Etter steg 3, men *før* sesjonoppretting, vises et **katalogkart**:
en tabell der én rad tilsvarer én underkatalog med minst ett bilde.

For enkelt tilfelle (alle bilder i rotkatalogen, ingen underkataloger):
katalogkartet kollapserer til én enkelt rad — ingen overhead.

**Rad-elementer:**

| Element | Beskrivelse |
|---------|-------------|
| Hake/minus | Inkluder i registrering / ekskluder (ingen event-tilknytning) |
| Katalognavn | Vises som relativ sti fra skanrot |
| Event-navn | Redigerbart tekstfelt, forhåndsutfylt av navnutledningsregelen |
| Status-badge | "Ny" (blå) / "Eksisterende: Sommerfest" (grønn) / ingen |
| Antall | Totalt antall bilder + antall nye i parentes |

**Statusbadge-logikk:**
- *Ny*: ingen eksisterende event funnet for denne katalogens sti
- *Eksisterende: X*: backend-oppslag fant at bilder med stier under denne
  katalogen allerede tilhører event X. Event-navnfeltet låses til X, men
  kan overstyres av brukeren.

**Mønstervelger:** Under tabellen vises valgt navnutledningsregel med
en innstillingsknapp. Endring av regel re-transformerer alle event-navnfeltene
umiddelbart.

### 4. Navnutledning fra mappenavn

Et **navnutledningsmønster** transformerer et mappenavn til et eventnavn.
Mønsteret er lagret per maskin i innstillinger og gjenbrukes mellom registreringer.

**Innebygde mønstre:**

| ID | Navn | Regel | Eksempel inn → ut |
|----|------|-------|-------------------|
| `identity` | Bruk mappenavn direkte | Ingen transformasjon | `Sommerfest 2024` → `Sommerfest 2024` |
| `strip_date_prefix` | Fjern dato-prefiks | Regex `^\d{4}[-_.]?\d{2}[-_.]?\d{2}[_ ]+` | `2024-07-15 Sommerfest` → `Sommerfest` |
| `strip_yyyymmdd_prefix` | Fjern kompakt dato-prefiks | Regex `^\d{8}[_ ]+` | `20240715Sommerfest` → `Sommerfest` |
| `strip_year_prefix` | Fjern årstall-prefiks | Regex `^\d{4}[_ -]+` | `2024 Sommerfest` → `Sommerfest` |
| `strip_number_prefix` | Fjern tall-prefiks | Regex `^\d+[._ ]+` | `01 Bryllup` → `Bryllup` |
| `custom` | Egendefinert regex | Named-capture `(?P<name>...)` | Brukerdefinert |

Default er `strip_date_prefix` — det vanligste mønsteret.

**Forhåndsvisning:** Mønstervelgeren viser ett eksempel fra faktiske
mappenavn i det aktuelle katalogtreet.

### 5. Granularitet: hvilket mappelengd er "eventnivået"?

Systemet bruker **høyest-variasjons-analyse** som default:
finn det dybdenivået der flest mappenavn varierer mellom filgrupper.
Det er typisk eventnivået.

```
/Bilder/2024/Sommerfest/IMG_001.jpg   ─┐
/Bilder/2024/Sommerfest/IMG_002.jpg   ─┤ → varierer på nivå 3 = Sommerfest
/Bilder/2024/Bergenstur/IMG_001.jpg   ─┘
```

Fallback: hvis analysen ikke gir entydige svar (f.eks. alle bilder
i rotmappen), brukes rot-katalogen.

Brukeren kan overstyre via innstillingshjulet i katalogkartet:
**"Bruk mappe på nivå [N] fra skannrot"** eller
**"Bruk nærmeste overmappe"** (alltid bladnivå).

Valget lagres i maskininnstillinger.

### 6. Event-matching via DB-oppslag

For å avgjøre om en underkatalog allerede er assosiert med et event
spør klienten backend:

```
POST /system/folder-event-lookup
Body:     { paths: string[] }          // absolutte stier for underkataloger
Response: {
  matches: [{
    path: string,
    event: { id: string, name: string } | null
  }]
}
```

Backend-implementasjon (SQL-basert, ingen ny tabell):

```sql
SELECT p.event_id, e.name, COUNT(*) AS cnt
FROM photos p
JOIN image_files f ON f.photo_id = p.id
JOIN events e ON e.id = p.event_id
WHERE f.file_path LIKE $folder_path || '/%'
  AND p.event_id IS NOT NULL
GROUP BY p.event_id, e.name
ORDER BY cnt DESC
LIMIT 1
```

Returnerer eventet som flest eksisterende bilder peker til for den stien.
En `folder_event_hints`-tabell vurderes først om ytelsen er utilstrekkelig
ved store samlinger (se Konsekvenser).

### 7. Per-bilde event_id i GroupPayload

`GroupPayload.event_id` finnes allerede og overstyrer
`InputSession.default_event_id` per gruppe. Klienten bruker dette til å
sende korrekt event per bilde basert på katalogkartet:

```
Bilde i /2024/Sommerfest/  →  event_id = <sommerfest-event-uuid>
Bilde i /2024/Bergenstur/  →  event_id = <bergenstur-event-uuid>
Bilde i rot                →  event_id = null  (ingen event)
```

`InputSession.default_event_id` settes til `null` som standard i den nye
flyten. Feltet beholdes i datamodellen for bakoverkompatibilitet, men
klienten bruker det ikke aktivt lenger.

### 8. Håndtering av flytt vs. kopi — utsatt

Systemet skiller foreløpig *ikke* mellom:
- **Kopi**: samme innhold, begge filstier gyldige
- **Flytt**: samme innhold, gammel sti er ugyldig, ny er gjeldende

Begge behandles som `DuplicateFile` med ny sti. Dette er tilstrekkelig for
alle scenario bortsett fra eksplisitt filreorganisering. Løsning planlegges
som en del av ADR-017 (fillokasjons-sporing): verktøy for å verifisere og
oppdatere stale filstier vil håndtere flytt-scenariet separat.

### 9. Eksisterende tomme sesjoner

Sesjoner med `photo_count=0` som allerede finnes i databasen filtreres bort
i SessionsListPage (`WHERE photo_count > 0 OR status != 'completed'`).
En "Rydd opp"-knapp i innstillinger kan slette dem permanent.

---

## Begrunnelse

**Sesjonsoppretting etter bekreftelse:** En sesjon bør representere noe
som faktisk skjedde. En sesjon med null bilder er logisk umulig i den
nye flyten fordi vi vet antall nye bilder *før* sesjonen opprettes. Det er
også mer riktig at katalogkart-steget er et forberedelsesteg uten forpliktelse,
ikke en del av selve registreringen.

**check-hothashes uten session_id:** Sjekken er rent spørrende og har ingen
bivirkning. Det er ikke riktig at den krever en forhåndsopprettet sesjon.
Endringen gjør det mulig å avgjøre om registrering overhodet er nødvendig
*før* noe opprettes i databasen.

**Detect-and-confirm fremfor configure-and-run:** Brukeren skal ikke måtte
konfigurere noe for å se et resultat. Mønsteret pre-fylles, DB-oppslag
skjer automatisk, og all informasjon vises i én tabell som brukeren kan
bekrefte eller justere. Det er et kortere kognitivt løp enn dagens
"velg event, skriv inn navn"-dialog.

**DB-oppslag fremfor `folder_event_hints`-tabell:** En ny tabell krever
vedlikehold og kan gå ut av sync. Direkte oppslag i eksisterende `image_files`
og `photos` trenger ingen migrering og fungerer retroaktivt på eksisterende
data. Det er akseptabelt for de størrelsene en enkeltbruker-instans vil ha
(titusener bilder, ikke millioner).

**Navnutledning kun på klientsiden:** Strengtransformasjon av mappenavn
er pure client-side logikk. Backend trenger ikke å kjenne til mønstre.
Klienten sender ferdige eventnavn (eller ber om eksisterende event fra DB).

---

## Konsekvenser

### Backend

1. **Nytt endepunkt:** `POST /photos/check-hothashes`
   — krever ikke `session_id`, delegerer til eksisterende `check_hothashes`-logikk.
   Gammelt `POST /input-sessions/{id}/check-hothashes` beholdes uendret.

2. **Nytt endepunkt:** `POST /system/folder-event-lookup`
   — tar liste av absolutte stier, returnerer event-match per sti via SQL-oppslag.

3. **`InputSessionCreate`-skjema:** `default_event_id` gjøres valgfri med
   default `null`. Ingen migrering — feltet er allerede nullable.

4. **`InputSession`-modell:** Ingen endringer.

5. **`GroupPayload`:** Ingen endringer — `event_id` er allerede valgfri per gruppe.

6. **Ytelsesindeks:** Legg til indeks på `image_files.file_path` for å støtte
   `LIKE '/path/%'`-oppslaget effektivt:
   ```sql
   CREATE INDEX ix_image_files_file_path ON image_files (file_path text_pattern_ops);
   ```

### Frontend / klient

7. **Ny klientflyt** i `StepSetup`: omstruktureres til å følge steg A og B
   beskrevet i beslutning 2. `handleNext` splittes i `handleAnalyze` og
   `handleStartRegistration`.

8. **Nytt steg: `StepFolderMap`** (erstatter `EventSection` i `StepSetup`):
   - Katalogkart-tabell med redigerbare eventnavn og status-badges
   - Mønstervelger med forhåndsvisning
   - Dybde-override i innstillingshjul

9. **`EventSection` fjernes** fra registreringsflyten.

10. **Nye API-funksjoner** i `src/api/`:
    - `checkHothashesGlobal(hothashes)` → `POST /photos/check-hothashes`
    - `lookupFolderEvents(paths)` → `POST /system/folder-event-lookup`

11. **Maskininnstillinger:** Legg til felt for lagret navnutledningsregel
    og mappedybde-valg.

12. **SessionsListPage:** Filtrer `photo_count === 0`-sesjoner fra listen.

### Ikke i scope

- `folder_event_hints`-tabell (vurderes ved ytelsesproblem)
- Skille mellom flyttede og kopierte filer (ADR-017)
- Path-migration-wizard for reorganisering av hele katalogtrær (ADR-017-oppfølger)
- Hierarkiske events speilet fra katalogstruktur
- Varsel/notifikasjon om at en katalog har fått nye filer siden sist skanning
