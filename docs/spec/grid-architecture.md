# Grid-arkitektur: BrowseView og CollectionView

## Problemet

BrowseView og CollectionView ser identiske ut (150×150 hotpreview-grid, blå seleksjonsring, hake) men er fundamentalt forskjellige på tre dimensjoner:

| Dimensjon | BrowseView | CollectionView |
|---|---|---|
| Elementtype | `PhotoListItem` | `CollectionItem` (foto eller tekstkort) |
| Seleksjonsidentitet | `hothash` | `CollectionItem.id` (UUID) |
| Rekkefølge | Server-bestemt (sorteringsparameter) | Brukerbestemt (eksplisitt `position`) |
| Lasting | Infinitt (100 om gangen, `useInfiniteQuery`) | Full liste én gang (`useQuery`) |
| Reorganisering | Ikke mulig | Drag-to-reorder (dnd-kit) |
| Ekstraelementer | Ingen | InsertionPoint, tekstkort |
| Caption | Ingen | Per-element (nullable) |

---

## Beslutninger

### Seleksjonsidentitet i CollectionView = CollectionItem.id

`hothash` er feil nøkkel for CollectionView fordi:
- Samme foto kan vises flere ganger i én collection
- Tekstkort har ingen hothash (`hothash = null`)
- Operasjoner (fjern, flytt) gjelder en *posisjon*, ikke et *foto*

### To separate seleksjonsstores

`useSelectionStore` (photo-seleksjon med hothashes) og `useCollectionViewStore` (CollectionItem-seleksjon med UUIDs) tjener ulike formål og deler ikke identitetsbegrep.

| | `useSelectionStore` | `useCollectionViewStore` |
|---|---|---|
| Nøkkel | hothash | CollectionItem.id |
| Formål | Batch-ops → SelectionTray | Lokal operasjon i CollectionView |
| SelectionTray | Ja | Nei |
| InsertionPoint | Nei | Ja |

### Delt seleksjonslogikk via factory-funksjon

`selectOnly / toggleOne / selectRange`-algoritmen er identisk i begge stores. En `createSelectionSlice(set)`-funksjon i `src/lib/selectionSlice.ts` oppretter tilstand og handlinger. Begge stores komponerer den inn. Ingen duplisert logikk.

### Delt visuell primitiv: ThumbnailShell

Den visuelle cellen (150×150, img, blå ring, hake, hover-overlay) er identisk. `ThumbnailShell` er en ren display-komponent uten seleksjons- eller navigasjonslogikk. `PhotoThumbnail` og `CollectionItemCell` wrapper den og legger til sin logikk.

### Escape tømmer begge stores

Escape-handlerne i `App.tsx` tømmer alltid begge stores (`.clear()` på begge). De to seleksjonene er aldri aktive samtidig i praksis — brukeren er på én side om gangen.

### InsertionPoint = virtuelt grid-element (150×150 celle)

InsertionPoint rendres som en full 150×150 celle med dashed-border og pluss-ikon. Den injiseres i grid-arrayen ved `insertionIndex`. dnd-kit håndterer det naturlig som en droppable posisjon.

### Drag-to-reorder = @dnd-kit

`@dnd-kit/core` + `@dnd-kit/sortable` + `@dnd-kit/utilities`. Ingen HTML5 DnD. Tastatur-tilgjengelig ut av boksen.

---

## Komponenthierarki

```
components/ui/
  ThumbnailShell.tsx          ← Delt visuell primitiv (img, ring, hake, overlay)

features/browse/
  PhotoGrid.tsx               ← Infinitt query, sort-kontroller
  PhotoThumbnail.tsx          ← Bruker ThumbnailShell; hothash-seleksjon

features/collection/
  CollectionGrid.tsx          ← Full liste, DndContext + SortableContext
  CollectionItemCell.tsx      ← Bruker ThumbnailShell eller TextCard; UUID-seleksjon
  InsertionPoint.tsx          ← 150×150 dashed-celle — cursor for innsetting
  TextCard.tsx                ← Tekstkort-celle (is_text_card = true)

stores/
  useSelectionStore.ts        ← Photo-seleksjon (hothashes) + createSelectionSlice
  useCollectionViewStore.ts   ← CollectionItem-seleksjon (UUIDs) + InsertionPoint

lib/
  selectionSlice.ts           ← createSelectionSlice(set) — delt logikk
```

---

## ThumbnailShell — interface

```typescript
interface ThumbnailShellProps {
  imageData: string           // base64 hotpreview_b64
  isSelected: boolean
  onClick: (e: React.MouseEvent) => void
  onDoubleClick: (e: React.MouseEvent) => void
  onContextMenu: (e: React.MouseEvent) => void
  bottomOverlay?: React.ReactNode  // dato (Browse) / caption (Collection)
}
```

---

## useCollectionViewStore — interface

```typescript
interface CollectionViewStore extends SelectionSlice {
  insertionIndex: number | null
  setInsertionPoint: (index: number | null) => void
}
```

`SelectionSlice` (fra `lib/selectionSlice.ts`) gir `selected`, `anchor`, `selectOnly`, `toggleOne`, `selectRange`, `clear`.

---

## CollectionGrid — dataflyt

```
useQuery(['collection-items', id]) → CollectionItem[]
  ↓
orderedIds = items.map(i => i.id)
  ↓
DndContext → SortableContext → grid
  ↓
Per item: CollectionItemCell (foto) | InsertionPoint (virtuell) | TextCard
  ↓
onDragEnd → arrayMove(orderedIds) → reorderCollectionItems(id, newOrder)
```

---

## API-typer

```typescript
interface Collection {
  id: string
  name: string
  description: string | null
  cover_hothash: string | null
  created_at: string
}

interface CollectionItem {
  id: string
  collection_id: string
  hothash: string | null         // null for tekstkort
  hotpreview_b64: string | null  // null for tekstkort; joined fra Photo i backend-response
  position: number
  caption: string | null
  is_text_card: boolean
  title: string | null           // tekstkort
  text_content: string | null    // tekstkort
}
```

---

## Fremtidige utvidelser

- Rubber-band selection (dra for å tegne rektangel) — utsatt
- Multi-select drag (flytt gruppe) — krever dnd-kit overlay
- InsertionPoint via drag (brukeren dragger markøren til ny posisjon)
- Virtualisering (TanStack Virtual) om collection vokser til 1000+ elementer
