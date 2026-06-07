# ADR-026: Søkeside-redesign — splittet layout med alltid-synlige kriterier

**Status:** Implementert  
**Dato:** 2026-06-05  
**Avhenger av:** ADR-025 (QuickView)

---

## Kontekst

Dagens `SearchPage` har tre brukbarhetssvakheter:

1. **Kriterier legges til ett om gangen.** Brukeren må klikke «Legg til kriterium»,
   velge felt i en nedtrekksliste, velge operator, fylle inn verdi — fire steg per
   kriterie. Det finnes ingen oversikt over tilgjengelige felt uten å åpne listen.

2. **«Kjør søk»-knappen bryter flyten.** Resultater oppdateres ikke mens brukeren
   skriver — de må eksplisitt trigge søket. Det gir en trykkende vente-vurder-sykkel
   i stedet for umiddelbar tilbakemelding.

3. **Kriterier og resultater er ikke synlige samtidig.** Kriteriebyggeren er over
   resultatene i en smal (`max-w-3xl`) kolonne. For å se effekten av en endring
   må brukeren scrolle ned og opp igjen.

ADR-023 (søkarkitektur) beskriver retningen: live søk, kontekstuell filtrering,
alt synlig. Denne ADR-en spesifiserer det konkrete layoutet og samspillet
for `SearchPage`.

---

## Beslutning

### 1. Splittet layout

`SearchPage` deles i to paneler som fyller hele skjermen:

```
┌── Kriterier (300px fast) ──────────────┬── Resultater ──────────────────────────┐
│  Navn: [Sommerbilder___________] [Lagre]│  1 247 bilder     [grid] [tidslinje]   │
│  ─────────────────────────────────────  │                                         │
│  Kobling:  [Alle (AND)]  [En av (OR)]   │  QuickView / PhotoTimeline              │
│                                         │                                         │
│  ●  Dato                                │  [□][□][□][□][□][□][□][□][□][□][□][□] │
│     Etter  [01.01.2024]                 │  [□][□][□][□][□][□][□][□][□][□][□][□] │
│                                         │                                         │
│  ●  Tags                                │                                         │
│     En av  [friluft ×] [natur ×]        │                                         │
│                                         │                                         │
│  ○  Vurdering                           │                                         │
│  ○  Fotograf                            │                                         │
│  ○  Event                               │                                         │
│  ○  Kamerafabrikat                      │                                         │
│  ○  Kameramodell                        │                                         │
└─────────────────────────────────────────┴─────────────────────────────────────────┘
```

Venstre panel: fast bredde 300 px, scrollbart ved mange felt.  
Høyre panel: fyller resterende bredde, viser søkeresultat.

### 2. Alltid-synlige felt — toggle-aktivering

Alle felt i `SEARCH_FIELDS` er alltid synlige i venstre panel. Ingen
«Legg til kriterium»-knapp.

**Inaktivt felt** (ett klikk aktiverer):
```
○  Vurdering
```
- Grå tekst, ingen kontroller vist
- Klikk på raden aktiverer feltet

**Aktivt felt** (ett klikk deaktiverer, klikk på ×-knapp i hjørnet):
```
●  Vurdering
   >=  [ 4 ]
```
- Blå sirkel / venstrekant
- Operator-velger og verdi-input synlig
- Lett fremhevet bakgrunn

Visuell konvensjon:
- Inaktive felt: `text-gray-500`, ingen bakgrunn
- Aktive felt: blå venstrekant (`border-l-2 border-blue-500`), `bg-gray-800/50`

Operatorvelger: kompakt inline `<select>` (samme som i dag). Verdiinput: `SearchValueInput`
(uendret komponent).

### 3. Live søk uten «Kjør søk»-knapp

Søket kjøres automatisk. Trigger: debounce 400 ms etter siste endring i
aktiverte kriterier eller verdier. Spinner vises i resultathoder mens søket pågår.

Teknisk: `useEffect` på `[activeCriteria, logic]` med `setTimeout`-debounce.
`activeCriteria` er utledet state — kun kriterier der `active === true` og
`value` er satt (eller operator ikke krever verdi, f.eks. `is_null`).

Ingen `applied`-state lenger — søket reflekterer alltid nåværende kriterier.

### 4. Kriterietilstand i venstre panel

Venstre panel holder tilstand lokalt i `SearchPage`:

```ts
type CriterionState = {
  active: boolean
  operator: string
  value?: SearchCriterion['value']
}
type PanelState = Record<string, CriterionState>  // keyed by field
```

Alle felt initialiseres med `active: false` og standardoperator.
Ved lasting av lagret søk: felt fra det lagrede søket settes til `active: true`
med tilhørende operator og verdi. Øvrige felt forblir `active: false`.

### 5. Resultater: QuickView som standard

Høyre panel viser `QuickView` (ADR-025) som standardvisning — tettgrid med
hotpreviews, ingen seleksjon. `ViewToggle` i resultathoder lar brukeren bytte
til `PhotoTimeline`.

Antall bilder vises i resultathoder: «1 247 bilder» (oppdateres live).

### 6. Navn og lagring

Søkenavnet beholdes øverst i venstre panel. «Lagre»-knapp kun i dette feltet.
Lagring serialiserer kun *aktive* kriterier til `searches`-tabellen (samme
format som i dag — ingen datamodell-endring).

---

## Begrunnelse

**Fast liste fremfor dynamisk liste:** Å vise alle tilgjengelige felt er bare
rimelig fordi antallet er lite (7 felt i dag, ~13 etter ADR-023). Brukeren
slipper å vite hva som finnes — de ser det. Kostnaden er noen ekstra rader
med inaktive felt. Det er en god trade-off.

**Toggle fremfor avkryssing:** En klikkbar rad (toggle) er raskere enn en
liten checkbox — større målflate, ett klikk, umiddelbar visuell feedback.

**400 ms debounce:** Kort nok til å oppleves som live, langt nok til å unngå
søk per tastetrykk. PostgreSQL med indekser svarer på kriteriesøk på < 100 ms
— nettverket er flaskehalsen, ikke databasen.

**QuickView fremfor PhotoGrid:** Søkeresultater kan inneholde tusenvis av bilder.
QuickView er designet for dette. PhotoGrid er designet for BrowsePage der
seleksjon og tildeling er primære handlinger. Se ADR-025.

**300 px panelbredde:** Smalere (240 px) er trangt for operatorvelger + verdiinput
side om side. Bredere (400 px) stjeler for mye fra resultatsiden. 300 px gir
plass til operatorkontroller uten å dominere layoutet.

---

## Konsekvenser

### Frontend

1. **`SearchPage.tsx`** skrives om:
   - Splittet layout (`flex h-full`)
   - Venstre panel: `CriteriaPanel`-komponent (ny)
   - Høyre panel: resultathodet + `QuickView` / `PhotoTimeline`
   - Ingen `applied`-state, ingen «Kjør søk»-knapp
   - `useEffect`-debounce på aktive kriterier

2. **Nytt komponent `CriteriaPanel.tsx`** (`src/features/search/`):
   - Rendrer én rad per felt i `SEARCH_FIELDS`
   - Holder `PanelState` som intern tilstand (eller prop fra SearchPage)
   - Eksponerer `onChange(criteria: SearchCriterion[], logic: 'AND'|'OR')`

3. **`SearchCriteriaBuilder.tsx`** erstattes av `CriteriaPanel.tsx`.
   Gammel komponent kan slettes eller beholdes for fremtidig gjenbruk
   (BrowsePage filter-panel, ADR-023 pkt. 6).

4. **`QuickView.tsx`** implementeres (ADR-025).

5. **`searchFields.ts`** endres ikke.

6. **`SearchValueInput.tsx`** og **`SearchCriterionRow.tsx`** endres ikke.

### Ikke i scope

- OR-grupper (ADR-023 pkt. 1) — utsettes
- Utvidede søkefelt (ADR-023 pkt. 2) — utsettes
- AI-rangering (ADR-023 pkt. 3) — utsettes
- Pin og dynamisk album-metadata (ADR-023 pkt. 4) — utsettes
- Kontekstuell filtrering i BrowsePage (ADR-023 pkt. 6) — utsettes
