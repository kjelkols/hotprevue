# Brainstorm: Event-tilknytning basert på katalogstruktur

*Dato: 2026-06-04 — ikke en ADR, men grunnlag for en*

---

## Hva er problemet egentlig?

Den nåværende `EventSection` i registrering spør: "Hva skal eventet hete?"
Det er gal innramming. Brukeren vet ikke alltid hva eventet heter ennå —
de vet at de skal registrere bilder fra en katalog, og katalogen *er* eventet.

Det er tre separate problemer som flettes sammen og bør løses uavhengig:

1. **Navngiving:** Hva skal eventet hete? (bør utledes fra stien)
2. **Granularitet:** Én katalog = ett event, eller én underkatalog per event?
3. **Administrasjon:** Opprette, redigere, slette events. (hører ikke hjemme her)

Dagens løsning blander alle tre i én komponent og gjør ingen av dem bra.

---

## Virkelighetens katalogstrukturer

Brukere organiserer bilder svært ulikt. Her er de vanligste mønstrene:

### Type A — Flat dato+navn
```
/Bilder/2024-07-15 Sommerfest/
/Bilder/2024-08-20 Tur til Bergen/
/Bilder/2024-12-24 Julaften/
```
Én katalog = ett event. Mappenavnet inneholder dato og eventnavn.
→ Utled eventnavn ved å strippe datoprefikset.

### Type B — År med underkataloger
```
/Bilder/2024/Sommerfest/
/Bilder/2024/Bergenstur/
/Bilder/2025/Påsketur/
```
Bruker skanner `/Bilder/2024/` — forventer to events: `Sommerfest` og `Bergenstur`.
Årstallsmappen er kontekst, ikke et event i seg selv.

### Type C — Minnekort-eksport, flat dato
```
/Bilder/20240715/
/Bilder/20240716/
/Bilder/20240717/
```
Ingen meningsfylt eventinformasjon i mappenavn. Brukeren er nødt til å navngi
manuelt, eller godta datoen som eventnavn, eller tildele event etterpå.

### Type D — En stor mappe med alt
```
/Bilder/Sommerfest2024/IMG_0001.jpg … IMG_0847.jpg
```
Enklest mulig: én katalog, ett event, mappenavnet er eventet (uten transformasjon).

### Type E — Dyp hierarki
```
/Bilder/Familie/2024/Sommer/Sommerfest/
/Bilder/Familie/2024/Sommer/Stranddager/
/Bilder/Reiser/2024/Bergen/
```
Bruker skanner én rot. Hvilket nivå er "eventet"? Det finnes ikke ett riktig svar.

### Type F — Blanding
Noen kataloger matcher et mønster, andre gjør det ikke. Virkeligheten er kaotisk.

---

## Kjernevalget: én eller mange events per registreringsøkt?

Dette er det viktigste designvalget og det som bestemmer alt annet.

### Alternativ 1: Alltid ett event per økt (nåværende)

**Fordel:** Enkelt. Ingen komplisert mappinglogikk.

**Ulempe:** Brukere som skanner `/Bilder/2024/` med 12 underkataloger må enten:
- Velge ett event for alle (feil)
- Skanne 12 ganger (tungvint)
- Tildele events manuelt etterpå via batch-assign (riktig, men ekstra steg)

**Konklusjon:** Fungerer for Type D. Utilstrekkelig for Type A, B, E.

### Alternativ 2: Én underkatalog = ett event (automatisk)

Systemet grupperer bilder etter nærmeste overmappe og oppretter ett event per unik mappe.

**Fordel:** Automatisk. Dekker Type A og B naturlig.

**Ulempe:**
- For Type E med 4 nivåer: oppretter events på feil nivå
- Kan opprette for mange events (f.eks. ett per dato-mappe fra minnekort)
- Brukeren har ingen kontroll

### Alternativ 3: Brukerstyrt mapping med forhåndsvisning

Etter at katalogsti er valgt, men *før* skanning, analyseres underkataloger
og presenteres for brukeren. Brukeren bestemmer hvilke kataloger som blir events.

**Fordel:** Full kontroll. Fleksibelt for alle katalogtypene.
**Ulempe:** Ekstra UI-steg. Kan virke komplisert for enkle tilfeller.

**Konklusjon:** Riktig løsning, men trenger god UX for at det ikke skal føles
som merarbeid. Må defaulte fornuftig for det enkle tilfellet.

---

## Navnutledning fra sti

Uavhengig av granularitet trenger vi en mekanisme for å gjøre et mappenavn
om til et eventnavn. Noen mønstre:

### Dato-stripping

Det vanligste mønsteret er `YYYY-MM-DD Navn` eller `YYYYMMDD Navn`:

```
"2024-07-15 Sommerfest"  →  "Sommerfest"
"20240715 Bergenstur"    →  "Bergenstur"
"2024_07_15-Julaften"    →  "Julaften"
```

Regelen er: finn et datoprefix (ISO-format, kompakt, med ulike skilletegn)
og fjern det. Bruk resten som eventnavn.

### Dato-suffix

```
"Sommerfest 2024-07-15"  →  "Sommerfest"
"Julaften (24.12.2024)"  →  "Julaften"
```

### Ingen dato — bruk mappenavn direkte

```
"Sommerfest"  →  "Sommerfest"
"Bergen trip" →  "Bergen trip"
```

### Nummerprefix

```
"01 Bryllup"  →  "Bryllup"
"42 Diverse"  →  "Diverse"
```

### Brukerdefinert regex

For avanserte brukere: en named-capture-regex som definerer hva eventnavn er:
```
Pattern: ^\d{4}-\d{2}-\d{2} (?P<name>.+)$
Input:   "2024-07-15 Sommerfest"
Match:   "Sommerfest"
```

---

## Foreslått design

### Prinsipp: detect-and-confirm, ikke configure-and-run

Brukeren skal *minst mulig* konfigurere før de ser resultater.
Systemet gjør et kvalifisert gjett, brukeren bekrefter eller justerer.

### Flyt for enkle tilfeller (Type D)

Bruker velger én katalog med bilder i rot. Systemet ser:
- Kun én mappe med bilder
- Bruker mappenavnet direkte som foreslått eventnavn
→ Ingen ekstra steg. Én bekreftelsesrad vises og brukeren bare klikker videre.

### Flyt for katalogtypene A og B

Bruker velger `/Bilder/2024/`. Systemet oppdager:
- 12 underkataloger med bilder
- Alle mapper følger mønsteret `YYYY-MM-DD Navn`
→ Viser en forhåndsvisning: "12 kataloger → 12 events. Navn foreslås ved å
   fjerne datoprefikset."

Brukeren kan:
- Godta alle (ett klikk)
- Redigere enkeltnavne (inline-edit)
- Slå sammen to kataloger til ett event (dra-og-slipp eller velg + merge)
- Sette noen kataloger til "ingen event" (bilder registreres uten event)

### Flyt for Type C (dato-mappe, ingen meningsfylt navn)

Systemet ser mapper som `20240715/`, `20240716/` — kun dato, ingen beskrivelse.
→ Foreslår dato som eventnavn (f.eks. "15. juli 2024")
→ Viser et hint: "Disse navnene ser ut til å kun inneholde datoer. Vil du
   registrere uten event og heller tildele events manuelt etterpå?"

---

## UI-konseptet: Katalogkart

En kompakt tabell som vises i StepSetup etter at katalogsti er valgt:

```
┌─────────────────────────────────────────────────────────────┐
│  Oppdaget 4 kataloger med bilder                            │
│                                                             │
│  Katalog                      Event-navn          Bilder   │
│  ─────────────────────────────────────────────────────────  │
│  ✓ 2024-07-15 Sommerfest   [Sommerfest        ]  47        │
│  ✓ 2024-08-20 Bergenstur   [Bergenstur        ]  31        │
│  ✓ 2024-12-24 Julaften     [Julaften          ]  23        │
│  – root (12 bilder)        [Ingen event       ]  12        │
│                                                             │
│  Mønster: Fjern dato-prefiks  [YYYY-MM-DD ]  ⚙             │
└─────────────────────────────────────────────────────────────┘
```

- Hver rad er redigerbar (event-navn er et input-felt)
- Hake = dette blir et event. Minus = ingen event for disse bildene.
- Bunnen viser hvilket mønster som er aktivt og en innstillingsknapp
- Innstillingsknapp åpner: velg mønster (forhåndsdefinerte + custom regex)

For enkelt tilfelle (én mappe):
```
┌─────────────────────────────────────────────────────────────┐
│  Katalog: Sommerfest 2024  →  Event: [Sommerfest 2024]      │
└─────────────────────────────────────────────────────────────┘
```
Ingen overhead — bare ett felt.

---

## Mønsterbibliotek (forhåndsdefinert)

Lagres i innstillinger. Brukeren velger ett mønster som default:

| Navn | Regex | Eksempel inn | Eksempel ut |
|------|-------|-------------|-------------|
| Bruk mappenavn direkte | `.+` | `Sommerfest 2024` | `Sommerfest 2024` |
| Fjern YYYY-MM-DD prefix | `^\d{4}-\d{2}-\d{2}[_ ]+(.+)` | `2024-07-15 Fest` | `Fest` |
| Fjern YYYYMMDD prefix | `^\d{8}[_ ]+(.+)` | `20240715 Fest` | `Fest` |
| Fjern tallprefix | `^\d+[._ ]+(.+)` | `01 Bryllup` | `Bryllup` |
| Fjern årstall | `^(\d{4})[_ ](.+)` | `2024 Sommerfest` | `Sommerfest` |
| Egendefinert regex | *(brukerdefinert)* | — | — |

Mønstret lagres per maskin i innstillinger og pre-fylles neste gang.

---

## Hva med dybde i katalogtreet?

For Type B (`/2024/Sommerfest/`) og Type E (`/Familie/2024/Sommer/Sommerfest/`)
må systemet vite *hvilket* nivå som er "eventet".

To tilnærminger:

### A: Analyser variasjon automatisk

Systemet ser på alle unike stier og finner det nivået der stiene divergerer
(høyeste variasjon). Det er typisk "eventnivået".

```
/Bilder/2024/Sommerfest/    ─┐
/Bilder/2024/Bergenstur/    ─┤ → varierer her: nivå 3 = event
/Bilder/2025/Påsketur/       ─┘
```

Fungerer bra i praksis, men kan feile ved ujevn struktur.

### B: Brukeren velger dybde

Under innstillingshjulet i katalogkartet: "Bruk mappe på nivå [1] [2] [3] fra rot"
eller alternativt "nivå [1] fra blad".

Anbefaling: **prøv A som default, tilby B som override**.

---

## Hva med "ingen event"?

Brukeren kan alltids registrere bilder uten event og tildele eventet etterpå.
Batch-assign via SelectionTray er allerede implementert. Dette er et fullgodt
alternativ for brukere med ustrukturert katalogorganisering — bedre enn å tvinge
dem gjennom event-opprettelse under registrering.

→ "Ingen event" bør alltid være et gyldig valg, og bør kanskje til og med
   vises tydelig som et alternativ på skjermen.

---

## Hva fjernes

- **"Velg eksisterende event"-modus** i EventSection: fjernes. Brukeren
  kan tildele eksisterende event etterpå via batch-assign. Det er aldri riktig
  tidspunkt å tildele ett eksisterende event til en ny registrering.

- **Inline event-administrasjon** (opprette event med navn i registreringsflyten):
  Beholdes *implisitt* — systemet oppretter events automatisk fra katalognavn.
  Brukeren kan redigere navnene i forhåndsvisningen før registrering starter.
  Etter registrering redigeres events på EventPage.

---

## Åpne spørsmål

1. **Kjøres kataloganalysen før skanning?**
   Ja, bør kjøres rett etter at bruker velger katalogsti. Vi kan liste undermapper
   uten å skanne innhold — det er raskt. Selve filskanningen starter ikke
   før brukeren bekrefter.

2. **Hva om nye bilder legges til en eksisterende katalog?**
   Brukeren registrerer `/2024/Sommerfest/` på nytt. Systemet ser at det
   finnes et event som heter "Sommerfest". Foreslå automatisk å bruke det
   eksisterende eventet i stedet for å opprette et nytt.
   → Dette er faktisk en grunn til å *beholde* logikken for å matche mot
     eksisterende events, men skjult bak automatikk, ikke som manuelt valg.

3. **Hierarkiske events?**
   Events støtter forelder-barn-hierarki (parent_event_id). Kan katalogstrukturen
   mappes til dette? F.eks. `2024/` → overordnet event, `Sommerfest/` → underevent.
   → Utelat for nå. Kompleksiteten overstiger nytten for de fleste brukere.

4. **Hva vises i StepScan?**
   I dag vises alle nye bilder som skal registreres. Med multi-event mapping
   bør listen også vise hvilken event hvert bilde er planlagt for.

---

## Anbefalt neste steg

1. Skriv ADR — beslutt: multi-event per økt (ja/nei), og format på
   katalogkart-UI.
2. Implementer `analyzeDirectoryForEvents(path, pattern)` på klientagenten:
   returnerer liste av `{ folderPath, suggestedEventName, imageCount }`.
3. Bytt ut `EventSection` med `FolderEventMapping`-komponent i StepSetup.
4. Lagre valgt mønster i maskininnstillinger.
