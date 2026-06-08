# Stack UX-strategi — kladd

**Status:** Kladd — ikke vedtatt  
**Dato:** 2026-06-08

---

## Kjerneprinsipper

**Disable fremfor feil.** Kontekstmenyen speiler tilstanden til utvalget. Brukeren
ser umiddelbart hva som er mulig — ingen reaktive feilmeldinger, ingen dialoger.

**Stack som atomisk UI-element.** En stack er én kortstokk i gridet, ikke et sett
bilder som kepper seg annerledes. Denne konseptuelle endringen forplanter seg
gjennom hele UI-et.

---

## Visuell modell

### Kollapset (standard)

- Cover-thumbnail med 2–3 forskjøvede «kort» bak (CSS transform — kortstokk-effekt)
- Antall-badge, f.eks. `×4`
- Hover (etter ~350 ms) → popover med mikro-thumbnails (~48×48 px), antall bilder
  — kun lesing, ingen handlinger
- Klikk → velger stacken

### Ekspandert (via global toggle «Ekspander stack»)

- Alle bilder i alle stacks vises, inkl. ikke-cover-bilder
- Stack-tilhørighet: subtle border/bakgrunn per stack (ulik farge per stack)
- Cover-bildet: `cover`-badge
- Hover på ikke-cover-bilde → tooltip med stackens cover-thumbnail
  («hvilken stack er dette?»)
- Utvalg velger individuelle bilder (ikke stacken som helhet)

**StackExpander-komponenten forsvinner.** Hover-popover + expand-modus erstatter den.

### Toggle «Ekspander stack»

- Avkrysningsboks i verktøylinja i grid-visningen
- Lagres i `useViewStore`, persisteres i localStorage
- Tømmer utvalget når tilstand skifter (unngår forvirring mellom modusene)
- Eneste måte å se og redigere individuelle bilder i en stack

---

## Kontekstmeny

Utvalget analyseres *før* menyen bygges. Aktive/grå valg:

| Utvalgssammensetning | Aktivt valg |
|---|---|
| Frie bilder ≥ 2, ingen stacks | **Opprett stack** |
| Frie bilder + nøyaktig én stack | **Legg til i stack** |
| Nøyaktig én stack, ingen andre | **Oppløs stack** |
| Stack-*medlemmer* (ikke-cover) i ekspandert modus | **Fjern fra stack** |
| Alt annet | Alle grå |

**«Opprett stack»** krever ≥ 2 frie bilder. Ett fritt bilde → grå.

**«Legg til i stack»** — de frie bildene flyttes inn i den ene stacken i utvalget.
Ingen dialog nødvendig.

**«Oppløs stack»** — én stack i utvalget, ingen individuelle bilder. Ingen
bekreftelsesdialog (handlingen er reversibel — bildene lever videre som frie).

**«Fjern fra stack»** — kun meningsfull i ekspandert modus for ikke-cover-bilder.
I kollapset modus representerer klikk på stack *stacken som helhet*, og «Fjern»
gir ikke mening der (bruk «Oppløs»).

---

## Seleksjonsmodell

`useSelectionStore` holder `Set<string>` med hothashes — ingen endring.

**Cover som proxy for stack.** Klikk på kollapset stack → velger cover-hothash.
Kontekstmenyen utleder stacken via `is_stack_cover` + `stack_id`. Ingen ny
seleksjonstype nødvendig.

*Konsekvens:* Shift-klikk-range som inneholder stacks velger cover-hothash (i
kollapset modus) eller individuelle bilder (i ekspandert modus). Intuitivt.

---

## «Sett som cover» og «Merk stack»

**«Sett som cover»** — ekspandert modus → høyreklikk på ikke-cover-bilde →
«Sett som cover» i kontekstmenyen. Grå for eksisterende cover.
Erstatter «Cover»-knappen i nåværende StackExpander.

**«Merk stack»** — ekspandert modus → høyreklikk på stacket bilde → «Merk stack».
Resetter utvalget og merker alle bilder i denne stacken. Nyttig før «Oppløs»,
«Sett event» osv. *Fase 2.*

---

## Hover-popover — ytelseshensyn

Popoveren trenger de øvrige bildenes hotpreviews. To alternativer:

**A) Separat API-kall:** `GET /stacks/{id}` ved hover. Enkel implementasjon, men
nettverkskall ved hover med ~350 ms delay kan merkes.

**B) Utvid `StackOut`:** Legg til `member_hotpreviews_b64: string[]` i `StackOut`.
Alle previews hentes i én query ved listevisning. Popoveren er umiddelbar.
Koster noe mer i payload for listevisningen.

**Anbefaling: B** for god responsivitet.

---

## Hva forsvinner

- `StackExpander.tsx`
- `StackCreateModal.tsx`
- Konfliktdialog («bilder er allerede i stack»)
- Toast-feilmeldinger for stack-operasjoner

---

## Åpne spørsmål

1. **Fjern cover i ekspandert modus.** Tillate det direkte (auto-tildeler nytt
   cover)? Eller kreve «Oppløs» for å fjerne coveret? Forslag: tillat i ekspandert
   modus (brukeren handler direkte, konsekvensen er synlig), ikke tillatt via
   «Fjern fra stack» i kollapset modus.

2. **Hover-popover med mange bilder.** Maks bredde, wrap på 6 per rad? Scrollbar
   ved > 12 bilder? Bør avklares.

3. **Visuell farging per stack.** Fast fargepalett (f.eks. 8 farger som gjenbrukes)
   eller hash-basert? Trenger ikke være unikt globalt — bare distinkt innenfor
   synlig område.

4. **Rekkefølge i popover.** Stack er uordnet — bilder vises i databaserekkefølge.
   Greit nok; stack er ikke collection.

---

## Oppsummering

```
Kollapset modus (standard):
  Stack = kortstokk, cover-thumbnail + ×N badge
  Hover → popover: mikro-bilder + antall
  Klikk → velger stacken (cover-hothash som proxy)

Ekspandert modus (toggle "Ekspander stack"):
  Alle bilder synlige, stackede merket med border/bakgrunn per stack
  Cover → "cover"-badge
  Hover på stacket bilde → tooltip med stack-cover for identifikasjon
  Utvalg velger individuelle bilder

Kontekstmeny (utvalgsanalyse før bygging):
  Frie bilder ≥ 2            → Opprett stack
  Frie bilder + én stack     → Legg til i stack
  Nøyaktig én stack          → Oppløs stack
  Stack-members (ekspandert) → Fjern fra stack
  Ellers                     → grå

Ekstra (fase 2):
  Høyreklikk stacket bilde (ekspandert) → Merk stack
  Høyreklikk ikke-cover (ekspandert)    → Sett som cover
```
