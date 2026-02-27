# SelectionTray — spec

## Konsept

SelectionTray er et persistent bunnpanel som vises i alle views når ett eller flere bilder er valgt (`selected.size > 0`). Utvalget er globalt og lever i `useSelectionStore` (Zustand) — det overlever navigasjon mellom sider.

Tray-et er *ikke* et flytende vindu. Det er en fast bunnlinje som skyver innhold oppover.

---

## Bunnlinje — struktur

```
[N bilder valgt]  [Vis utvalg ↑]  ···  [Legg til i kolleksjon]  [Slett]  [✕ Tøm]
```

- **N bilder valgt** — tekst, alltid synlig
- **Vis utvalg ↑** — åpner SelectionModal
- **Handlingsknapper** — batch-operasjoner (kontekstsensitive)
- **✕ Tøm** — tømmer utvalget (`clear()`)

Bunnlinjen er alltid montert i `App.tsx`, utenfor `<Routes>`. Den rendrer `null` når `selected.size === 0`.

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

**Styrker:**
- Brukeren kan kuratere utvalget — fjerne enkeltbilder — før batch-operasjon
- Ingen permanente konsekvenser: lukk modal = ingenting endres
- Naturlig arbeidsflyt: velg grovt i BrowseView → åpne modal → finjuster → handling
- Triviell å bygge: `useSelectionStore` + Radix Dialog + mini-grid

**Svakheter:**
- Modal + bunnlinje = to trinn for å se og handle. Akseptabelt — de har ulik hensikt
- Hotpreview-data mangler i store (kun hothashes lagres). Løses ved lazy fetch ved modal-åpning
- Utvalg forsvinner ved Electron-restart. Akseptabelt for v1

---

## Backend-endring

`GET /photos` trenger `hothash`-array-filter for at modalen kan hente previews:

```
GET /photos?hothash=abc123&hothash=def456&...
```

Implementeres som `hothash: list[str] | None = Query(None)` i FastAPI.

---

## Komponentstruktur

```
src/features/selection/
  SelectionTray.tsx       — bunnlinje (~60 linjer)
  SelectionModal.tsx      — Radix Dialog + grid (~80 linjer)
  SelectionThumbnail.tsx  — enkelt thumbnail i modal-grid (med remove-overlay)
```

Montert i `App.tsx`:
```tsx
<HashRouter>
  <Routes>...</Routes>
  <ContextMenuOverlay />
  <SelectionTray />   ← ny
</HashRouter>
```

---

## Handlinger (fase 1)

| Handling | Beskrivelse |
|---|---|
| Vis utvalg | Åpner SelectionModal |
| Legg til i kolleksjon | Åpner kolleksjonvelger (fremtidig: CollectionPickerModal) |
| Slett | Soft-delete alle valgte (batch/delete) + tøm utvalg |
| Tøm | Tøm utvalg uten handling |

`Legg til i kolleksjon` implementeres som en enkel liste over eksisterende kolleksjoner i en Radix Popover eller Dialog. Implementeres etter SelectionTray er ferdig.

---

## Tastatur

- `Escape` — lukker modal (hvis åpen), ellers tømmer utvalg (håndteres i App.tsx)
- Modal fanges av Radix Dialog (focus trap, Escape lukker)

---

## Visuell plassering

Bunnlinjen er `position: fixed; bottom: 0; left: 0; right: 0` med `z-index` over innhold. Sideinnhold trenger `padding-bottom` tilsvarende bunnlinjens høyde når den er synlig. Alternativt: bunnlinjen er i normal flow og hele App har `flex flex-col h-screen`.
