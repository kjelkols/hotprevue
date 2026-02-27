# Rubber-band-seleksjon i CollectionView — utsatt implementasjon

**Status:** Utsatt. Rubber-band er aktivt deaktivert i `CollectionGrid` (`select-none`).

---

## Hva er rubber-band-seleksjon?

Et seleksjonsrektangel som tegnes mens brukeren holder nede musknappen og drar over
et grid. Elementer som overlapper rektangelet markeres som valgt — slik Windows
Explorer, macOS Finder og de fleste bildebehandlingsprogrammer gjør det.

Det brukeren observerte i CollectionGrid var nettleserens innebygde
tekst/element-seleksjon (blå uthevingsboks over HTML-elementer). Dette er *ikke* det
samme som ekte rubber-band; det er bare nettleserens standard markerings­atferd. Ekte
rubber-band krever en egendefinert implementasjon.

---

## Hvorfor ikke nå

CollectionView er et **ordnet** sekvensielt medium — rekkefølgen er semantisk
meningsfull (presentasjonsrekkefølge, flyt i lysbildefremvisning). Rubber-band
forutsetter at brukeren forstår hvilke items som er innenfor rektangelet på skjermen,
noe som er intuitivt i et uordnet galleri men tvetydig i et ordnet rutenett:

- Rubber-band velger etter *visuell posisjon*, ikke *sekvensposisjon*. Hvis layouten
  brytes over flere rader kan det være uklart for brukeren hva som er «mellom» to items.
- Kombinasjonen rubber-band + drag-and-drop krever at de to gestene er tydelig
  atskilte, noe som kompliserer UX uten åpenbar gevinst for dette bruksområdet.

---

## Teknisk tilnærming når det implementeres

### Forutsetning

Multi-select i collection er allerede delvis utredet. Se
`docs/drafts/collection-multi-select.md` for backend-infrastruktur og forkastede
frontend-forsøk.

### Steg 1 — dnd-kit delay-constraint

Bytt `activationConstraint` på `PointerSensor` fra `distance` til `delay + tolerance`:

```typescript
useSensor(PointerSensor, {
  activationConstraint: { delay: 200, tolerance: 20 },
})
```

- `delay: 200` ms: standard for «long-press to drag» (brukt av iOS og macOS Finder)
- `tolerance: 20` px: tillater litt hånd-skjelv uten å kansellere timer
- Kjapt drag (>20 px innen 200 ms) → drag-timer kanselleres → rubber-band kan starte
- Rolig trykk-og-hold (200 ms uten >20 px bevegelse) → dnd-kit drag aktiveres

Ulempe: 200 ms forsinkelse er merkbar ved reordering. Vurder 150 ms som kompromiss.

### Steg 2 — fjern select-none og legg til overlay

Fjern `select-none` fra grid-containeren. Legg til et absolutt posisjonert
`<div>`-overlay i grid-wrapperen som lytter på `mousedown`/`mousemove`/`mouseup`:

```tsx
// Skjematisk
<div className="relative" onMouseDown={handleRubberBandStart}>
  {/* seleksjonsrektangel */}
  {isSelecting && (
    <div
      className="absolute border border-blue-400 bg-blue-400/10 pointer-events-none z-30"
      style={{ left, top, width, height }}
    />
  )}
  <DndContext ...>
    ...
  </DndContext>
</div>
```

### Steg 3 — hitbox-sjekk

For hvert `CollectionItemCell` lagres en `ref`. Etter `mouseup` itereres alle refs og
sammenlignes med rektangelbounds via `getBoundingClientRect()`. Items som overlapper
legges til seleksjons­slicen.

### Steg 4 — seleksjonsslice

`useCollectionViewStore` utvides med en seleksjonsslice (click/ctrl/shift/rubber-band),
isolert fra global `useSelectionStore`. Se `src/lib/selectionSlice.ts` som er bevart
fra tidligere implementasjon og kan gjenbrukes direkte.

### Steg 5 — handlingsbar

Gjeninnfør `CollectionActionBar` (beskrevet i `collection-multi-select.md`) med
«Flytt til slutt» og «Fjern fra kolleksjon».

---

## Snareste fremgangsmåte

1. `delay`-constraint i dnd-kit (5 min)
2. Rubber-band-overlay med rektangel (2–3 t)
3. Hitbox-sjekk mot item-refs (1 t)
4. Koble til seleksjonsslice + CollectionActionBar (1–2 t)

Total estimert innsats: en halv arbeidsdag.
