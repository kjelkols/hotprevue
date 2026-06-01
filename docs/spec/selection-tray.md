# SelectionTray — spec

## Konsept

SelectionTray er et persistent bunnpanel som vises i BrowseView-kontekster når ett eller flere bilder er valgt (`selected.size > 0`). Utvalget lever i `useSelectionStore` (Zustand).

Tray-et er *ikke* et flytende vindu. Det er en fast bunnlinje som skyver innhold oppover.

**SelectionTray er ikke tilgjengelig i CollectionView.** CollectionView bruker InsertionPoint og sin egen kontekstmeny for elementoperasjoner. Det finnes ingen avkryssingstilstand i CollectionView.

---

## Bunnlinje — struktur

```
[N bilder valgt]  [Vis utvalg ↑]  ···  [Legg til i…]  [✕ Tøm]
```

- **N bilder valgt** — tekst, alltid synlig
- **Vis utvalg ↑** — åpner SelectionModal
- **Legg til i…** — åpner popover med valg: Event / Samling / Tag
- **✕ Tøm** — tømmer utvalget (`clear()`)

Bunnlinjen er alltid montert i `App.tsx`, utenfor `<Routes>`. Den rendrer `null` når `selected.size === 0`.

Tray-et har ingen avhengighet til NavigationStore eller noen global mål-tilstand. Handlinger utløser alltid en picker-modal.

---

## Handlinger

| Handling | Beskrivelse |
|---|---|
| Vis utvalg | Åpner SelectionModal |
| Legg til i… → Event | Åpner EventPickerModal |
| Legg til i… → Samling | Åpner CollectionPickerModal |
| Legg til i… → Tag | Åpner TagPickerModal |
| Tøm | Tøm utvalg uten handling |

Se `photo-assignment.md` for fullstendig spec for picker-modalene.

---

## SelectionModal — intern gridvisning

Radix Dialog som åpnes fra "Vis utvalg"-knappen.

**Innhold:**
- Overskrift: `N bilder valgt`
- Grid med hotpreview-thumbnails for alle valgte bilder
- Klikk på thumbnail → fjerner bildet fra utvalget (`toggleOne`)
- Hover-overlay: `✕`-ikon som indikerer at klikk fjerner
- Footer: `[Lukk]`

**Dataflyt:**
- Modal fetcher `GET /photos` med alle hothashes som query-param ved åpning
- React Query cacher responsen

---

## Tastatur

- `Escape` — lukker modal (hvis åpen), ellers tømmer utvalg (håndteres i `App.tsx`)
- Modal fanges av Radix Dialog (focus trap, Escape lukker)

---

## Visuell plassering

Bunnlinjen er `position: fixed; bottom: 0; left: 0; right: 0` med `z-index` over innhold. Sideinnhold trenger `padding-bottom` tilsvarende bunnlinjens høyde når den er synlig.

---

## Komponentstruktur

```
src/features/selection/
  SelectionTray.tsx       — bunnlinje
  SelectionModal.tsx      — Radix Dialog + grid
src/features/assignment/
  AssignButton.tsx        — "Legg til i…"-knapp med popover
  EventPickerModal.tsx
  CollectionPickerModal.tsx
  TagPickerModal.tsx
```
