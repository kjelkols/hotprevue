# Brainstorm: Gjenskan og reorganisering av allerede registrerte kataloger

*Dato: 2026-06-04 — leses i sammenheng med `event-fra-katalogsti.md`*

---

## Hva systemet allerede kan

Det er verdt å starte med hva som faktisk fungerer. `register_group` har to
deduplikasjonssjekker:

1. **Sti-match** (`ImageFile.file_path == master_path`): filen er nøyaktig
   den samme som sist. Status: `already_registered`. Ingen ny rad.

2. **Innholdssjekk** (`Photo.hothash == hothash`): innhold gjenkjent, men stien
   er ny. Status: `duplicate`. Ny `DuplicateFile`-rad opprettes.

Og `check_hothashes` lar klienten spørre "hvilke av disse er allerede i systemet?"
*før* dyre coldpreview-genereringer.

Grunnmuren for deduplikasjon er altså solid. Problemene ligger ett lag opp:
i sesjonslogikk, i UX, og i grensen mellom "duplikat" og "flyttet fil".

---

## De fem gjenskan-scenariene

### Scenario 1: Tillegg til eksisterende katalog (ønsket bruk)

```
/Bilder/2024/Sommerfest/  — 47 bilder registrert
→ Brukeren tar 5 ekstra bilder fra samme event og kopierer dem til mappen
→ Skanner /Bilder/2024/Sommerfest/ på nytt
```

**Nåværende atferd:** 47 duplikater + 5 nye → session får `photo_count=5`,
`duplicate_count=47`. Fungerer. De 5 nye bildene bør knyttes til det samme
eventet som de 47.

**Problem:** Brukeren må manuelt velge samme event i StepSetup, eller et nytt
event med samme navn opprettes. Det er feil.

**Ønsket atferd:** Systemet ser at `/Bilder/2024/Sommerfest/` allerede er
assosiert med event "Sommerfest" og foreslår dette automatisk — ingen
manuell event-velger nødvendig.

---

### Scenario 2: Ulykkesskann (null nye bilder)

```
/Bilder/2024/Sommerfest/  — 47 bilder registrert
→ Brukeren skanner samme katalog ved en feil
→ Alle 47 er duplikater, ingen nye
```

**Nåværende atferd:** Session opprettes (`status='completed'`, `photo_count=0`,
`duplicate_count=47`). Den vises i SessionsListPage. Meningsløs støy.

**Ønsket atferd:** Ingen session opprettes. Brukeren ser en beskjed:
"Alle 47 bilder i denne katalogen er allerede registrert" — og kan avbryte
eller fortsette til en annen katalog uten at det etterlater spor.

**Teknisk problem:** I dag opprettes session *før* `check_hothashes` kalles.
Se seksjonen om sesjonsoppretting nedenfor.

---

### Scenario 3: Reorganisering — filer er flyttet

```
/GammelDisk/2024/Sommerfest/  — 47 bilder registrert (image_files.file_path peker hit)
→ Bruker bytter disk, kopierer alt til /NyDisk/2024/Sommerfest/
→ Vil oppdatere systemet med nye stier
```

**Nåværende atferd:** Hothash-sjekk finner alle 47 som kjente. Men sti er ny
→ opprettes som `DuplicateFile` med den nye stien. Originale `image_files`-rader
peker fortsatt på `/GammelDisk/...`. Begge stiene eksisterer i databasen,
men rollen er omvendt: den "gjeldende" stien er nå duplikat-raden.

**Grunnproblemet:** Systemet skiller ikke mellom:
- **Kopi**: samme innhold, begge stier eksisterer og er gyldige
- **Flytt**: samme innhold, gammel sti er ugyldig, ny sti er den gyldige

Disse har helt ulik semantikk men behandles identisk.

**Mulige løsninger:**

*A — Passiv*: La det ligge. ADR-017 (fillokasjons-sporing) håndterer
stale-deteksjon over tid via filverifikasjon. Brukeren kan trigge
"verifiser stier"-operasjon som finner stale paths og tilbyr å oppdatere dem.

*B — Aktiv re-skanmodus*: En egen modus i registreringsflyten: "Oppdater
filstier". Klienten rapporterer: for hvert bilde — er originalstien fortsatt
gyldig? Hvis ja → kopi. Hvis nei → flytt. Backend oppdaterer
`image_files.file_path` ved flytt, oppretter `DuplicateFile` ved kopi.

*C — Klient rapporterer sti-status*: I `GroupPayload` legges til et felt
`original_path_exists: bool`. Klienten sjekker om originalfilen i DB
finnes på disk. Hvis `False` → backend oppdaterer stien i stedet for å
opprette duplikat.

**Anbefaling:** Start med A. Det er det enkleste og ADR-017 er allerede planlagt.
B og C er riktig løsning på sikt, men er ikke nødvendig for MVP.

---

### Scenario 4: Rot-skan som overlapper med tidligere delskan

```
/Bilder/2024/Sommerfest/  — tidligere skannet
/Bilder/2024/Bergenstur/  — ikke skannet
→ Brukeren skanner hele /Bilder/2024/
```

**Nåværende atferd:** Sommerfest-bilder blir duplikater, Bergenstur-bilder
registreres. Fungerer korrekt.

**Problem:** I event-fra-katalogsti-flyten (katalogkart-UI) vil systemet foreslå
to events: "Sommerfest" og "Bergenstur". For Sommerfest bør det automatisk
koble til det *eksisterende* eventet, ikke opprette et nytt. For Bergenstur
er det riktig å opprette nytt.

**Ønsket atferd:** Katalogkart-analysen slår opp eksisterende event-assosiasjoner
per underkatalog. Rader der katalogen allerede er kjent vises med
"→ Eksisterende event: Sommerfest" (grønt). Rader som er nye vises med
"→ Nytt event: Bergenstur" (blått).

---

### Scenario 5: Full re-skan etter filreorganisering i katalogtre

```
/Bilder/  — stort katalogtre, spredt over år
→ Brukeren har reorganisert mapper, endret navn, justert hierarki
→ Vil "oppdatere" systemet med ny struktur
```

Dette er den mest komplekse varianten — en kombinasjon av scenario 1, 3
og 4 på tvers av mange kataloger. Uten verktøy for sti-oppdatering (scenario 3B/C)
er dette ikke mulig å gjøre uten manuelle operasjoner.

**Anbefaling for nå:** Dokumenter scenariet, men ikke løs det. Det er et
edge case som krever egne verktøy (ADR-017 + eventuell "path migration wizard").

---

## Det tekniske kjerneproblemet: sesjonsoppretting for tidlig

I dag er flyten i `StepSetup.handleNext()`:

```
1. scanDirectory(path)
2. createSession(...)          ← session opprettes HER
3. hashFile(group) × N         ← hotpreview genereres
4. checkHothashes(session.id)  ← nå vet vi om det er noe nytt
5. Hvis ingen nye: viser "Allerede registrert"-skjerm
   Men session finnes allerede i databasen!
```

Problemet er at `createSession` kjøres *før* vi vet om det finnes noe å gjøre.
I tillegg krever `check_hothashes` en `session_id` i dag — APIet er
`POST /input-sessions/{session_id}/check-hothashes`.

### Løsning: Skill `check_hothashes` fra sesjon

Gjør hothash-sjekk til et sessjon-uavhengig endepunkt:

```
POST /photos/check-hothashes
Body: { hothashes: string[] }
Response: { known: string[], unknown: string[] }
```

Ny flyt i klienten:
```
1. scanDirectory(path)
2. hashFile(group) × N                     ← hotpreview genereres
3. POST /photos/check-hothashes            ← ingen session nødvendig
4. Hvis unknown.length === 0:
     → vis "Alle bilder allerede registrert", avslutt. Ingen session.
5. Vis katalogkart + event-mapping (fra event-fra-katalogsti.md)
6. Bruker bekrefter
7. createSession(...)                      ← session opprettes NÅ, vi vet det er noe å gjøre
8. POST /input-sessions/{id}/groups × M   ← bare nye bilder
```

**Fordeler:**
- Ingen tomme sessions i databasen
- Katalogkart-UI kan vises *uten* at en session er opprettet — er mer
  passende siden brukeren ikke har bekreftet noe ennå
- Tydelig sekvens: analyser → bekreft → registrer

---

## Event-matching ved gjenskan (kobling til event-fra-katalogsti.md)

Katalogkart-analysen (fra `event-fra-katalogsti.md`) trenger å vite om en
underkatalog allerede er assosiert med et event. To måter å slå dette opp:

### Alternativ A: Slå opp via eksisterende bilder

For hver underkatalog: finn photos der `image_files.file_path` starter med
katalogstien. Hent deres `event_id`. Hvis alle (eller de fleste) peker på
samme event → katalogen er assosiert med det eventet.

```sql
SELECT p.event_id, COUNT(*) as cnt
FROM photos p
JOIN image_files f ON f.photo_id = p.id
WHERE f.file_path LIKE '/Bilder/2024/Sommerfest/%'
  AND p.event_id IS NOT NULL
GROUP BY p.event_id
ORDER BY cnt DESC
LIMIT 1
```

**Fordel:** Ingen ny datastruktur. Fungerer retroaktivt for eksisterende data.
**Ulempe:** Treg for store samlinger. Krever filsti-oppslag på backend.

### Alternativ B: Eksplisitt katalog-event-tabell

```sql
CREATE TABLE folder_event_hints (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    folder_path     TEXT NOT NULL,
    event_id        UUID REFERENCES events(id) ON DELETE CASCADE,
    confidence      TEXT NOT NULL DEFAULT 'explicit',  -- 'explicit' | 'inferred'
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

Populeres:
- Når en katalog registreres og knyttes til et event: `confidence='explicit'`
- Kan oppdateres/overstyres av brukeren i katalogkart-UI

**Fordel:** Rask oppslag. Eksplisitt, overprøvbar.
**Ulempe:** Ny tabell, ekstra vedlikehold. Kan bli utdatert om brukeren
endrer event-tilknytning uten å oppdatere tabellen.

### Anbefaling

Bruk alternativ A for MVP (ingen ny datastruktur, retroaktiv), men wrap det
i en dedikert API-funksjon slik at det enkelt kan byttes til B ved ytelsesproblem:

```
POST /system/analyze-folder
Body: { path: string, pattern?: string }
Response: {
  subfolders: [{
    path: string,
    image_count: number,       // antall filer (fra filsystem)
    suggested_event_name: string,
    existing_event?: { id: string, name: string }  // A: oppslag i DB
  }]
}
```

---

## Hva med sesjoner med null bilder som allerede finnes?

Eksisterende databaser kan ha sessions med `photo_count=0`. Disse bør filtreres
bort i SessionsListPage, eventuelt auto-slettes ved komprimering:

- Filtrer `photo_count = 0 AND status = 'completed'` fra visning
- Valgfri "rydd opp tomme sesjoner"-knapp i innstillinger

---

## Oppsummering: hva bør besluttes i ADR

Dette brainstormdokumentet peker mot følgende ADR-beslutninger:

| Spørsmål | Anbefalt valg |
|----------|--------------|
| Skal `check_hothashes` kreve session_id? | Nei — gjør det sessjon-uavhengig |
| Skal session opprettes før eller etter brukerbekreftelse? | Etter |
| Skal null-bilder-sesjoner forhindres eller filtreres? | Forhindres (ny flyt) |
| Skal event-matching ved gjenskan skje via DB-oppslag? | Ja, via filsti-pattern (alt. A) |
| Skal flytt vs. kopi skilles? | Nei i MVP; løses via ADR-017-oppfølger |
| Trenger vi `folder_event_hints`-tabell? | Ikke i MVP; vurder ved ytelsesproblem |

---

## Tidslinje og avhengigheter

```
event-fra-katalogsti.md  ──┐
gjenskan-og-reorganisering  ──┤──→ ADR-024: Registreringsflyt v2
                              │
ADR-017 (filsporing)    ──────┘      (dekker: multi-event, gjenskan, tomme sesjoner)
```

De to brainstormdokumentene henger så tett sammen at de bør bli én ADR.
