# InsertionPoint — spec

## Konsept

InsertionPoint er en **kursorposisjon** mellom elementer i CollectionGrid, ikke et eget element. Den tar ikke plass i layouten. Den markerer *mellom* element N og N+1 der neste batch med bilder vil settes inn.

Analogien er tekstkursoren: den er alltid til stede, den er synlig men ikke forstyrrende, og den flyttes med tastatur eller mus.

---

## Visuell form

**Aktiv kursor (alltid synlig):**
En 2px blå, absolutt-posisjonert vertikal strek langs venstre kant av elementet som er *etter* kursoren. Strekens farge: `blue-400` med subtil glød.

```
[img1] [img2] |[img3] [img4]
               ↑ kursor mellom 2 og 3 (insertionIndex = 2)
```

Den er absolutt-posisjonert inni `CollectionItemCell` — ingen layoutpåvirkning.

**Kursor ved slutten (etter siste element):**
En smal celle (`w-6 h-[150px]`) i gridflaten med den samme vertikale streklinjen inne i seg. Minimal gridplass, naturlig plassering etter siste rad.

**Tom kolleksjon:**
Fullt slot (150×150px) med stiplet blå ramme og `+`-ikon. Eneste kontekst der en hel rute er riktig.

---

## Interaksjonssoner per element

Hvert element har to distinkte soner:

```
┌──────────────────┐
│◀12px▶│           │
│ kursor│ seleksjon│
│  sone │   sone   │
└──────────────────┘
```

- **Venstre 12px — kursorsone:** `cursor-col-resize`, hover → preview-linje (blå/40), klikk → setter `insertionIndex = elementets indeks`. Klikk stopper propagasjon (ingen seleksjon).
- **Resten — seleksjonssone:** uendret atferd (click/ctrl/shift-click).

De to sonene er aldri i konflikt.

---

## Hover-preview

`CollectionGrid` holder `hoveredIndex: number | null` som lokal state (ikke i Zustand — kun visuell feedback).

- Muspeker inn i kursorsone på element N → `hoveredIndex = N` → preview-linje (`blue-300/40`) på element N
- Muspeker forlater → `hoveredIndex = null`

Preview-linjen er uavhengig av aktiv kursor: begge kan vises samtidig (preview på ett element, aktiv kursor på et annet).

---

## Tastaturnavigasjon

`CollectionGrid` lytter på `keydown` (via `tabIndex={0}` på grid-wrapper):

| Tast | Handling |
|---|---|
| `←` | `insertionIndex = max(0, insertionIndex - 1)` |
| `→` | `insertionIndex = min(items.length, insertionIndex + 1)` |

Opp/ned (hopp over hele rader) legges til når `ResizeObserver`-basert kolonnedetektor er på plass.

---

## Innsettingshandling

Trigger: **"Sett inn N bilder"-knapp i `CollectionPage`-headeren**. Synlig kun når `useSelectionStore.selected.size > 0`.

Sekvens (håndtert av `useCollectionInsert`-hook):
1. `POST /collections/{id}/items/batch` med alle valgte hothashes → returnerer nye items med IDer
2. Beregn ny rekkefølge: `[...eksisterende[0..insertionIndex], ...nyeIds, ...eksisterende[insertionIndex..]]`
3. `PUT /collections/{id}/items` med ny rekkefølge
4. Tøm `useSelectionStore`
5. Sett `insertionIndex = insertionIndex + antall_nye`

---

## State-modell

```typescript
// useCollectionViewStore — global (Zustand)
insertionIndex: number | null   // null = ved slutten (items.length)

// CollectionGrid — lokal React state
hoveredIndex: number | null     // kun visuell preview, ikke persistent
```

`insertionIndex` nullstilles ved `collectionId`-bytte via `useEffect` i `CollectionGrid`.

---

## Komponentstruktur

```
CollectionGrid
  ├── [items.length === 0] EmptyCollectionSlot (tidligere InsertionPoint)
  ├── CollectionItemCell (isCursorBefore, isPreviewBefore, onCursorZoneEnter/Leave/Click)
  │     └── CursorLine (absolutt-posisjonert, kun synlig når aktiv eller preview)
  │     └── CursorZoneOverlay (absolutt, venstre 12px, fanger museeventer)
  └── CursorEndIndicator (smal gridcelle etter siste element)

CollectionPage (header)
  └── InsertButton (leser useCollectionInsert — synlig ved selection > 0)

useCollectionInsert (hook)
  └── batch-add + reorder + clear selection
```

---

## Ikke-Collection-views

I BrowseView, Events, Sessions: SelectionTray viser "Legg til i kolleksjon" → CollectionPickerModal → legg til på slutten. Ingen InsertionPoint. Implementeres separat.
