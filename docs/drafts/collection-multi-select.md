# Collection multi-select og multi-drag — utsatt implementasjon

**Status:** Utsatt. Infrastrukturen (backend batch-slett) er på plass. Seleksjonslaget ble fjernet fra frontend fordi dra-oppførselen ikke fungerte som forventet.

---

## Hva ble implementert

### Backend (ligger igjen, fullt fungerende)

- `DELETE /collections/{id}/items/batch` med body `{ item_ids: uuid[] }` → 204
- Orphan-opprydding: sletter `text_items` automatisk hvis siste referanse fjernes
- Schema: `CollectionItemBatchDelete` i `backend/schemas/collection.py`
- Service: `delete_items_batch()` i `backend/services/collection_service.py`

### Frontend (fjernet)

Følgende ble implementert og siden fjernet:

- `useCollectionViewStore` utvidet med `SelectionSlice` (click/ctrl+click/shift+click på collection items, isolert fra global `useSelectionStore`)
- `CollectionActionBar` — handlingsbar som viste seg når ett eller flere items var valgt, med knapper for "Flytt hit" og "Fjern fra kolleksjon"
- `CollectionDragOverlay` — egendefinert drag ghost med antall-badge ved multi-drag
- `isGroupDragging`-prop på `CollectionItemCell` — dimmet opacity på items som "henger med" i draget
- Multi-drag-algoritme i `onDragEnd`: flyttet alle valgte items til drop-posisjon

---

## Problemet

Seleksjon og klikk fungerte (blå ring, ctrl+klikk, shift+klikk). Men multi-drag virket ikke:

**Symptom:** Drag flyttet alltid bare det ene bildet som ble draet. De andre valgte bildene påvirkes ikke.

**Hypotese:** dnd-kit bufrer `onDragEnd`-callbacken internt og holder en gammel versjon fra første render, slik at `selected`-settet var tomt eller hadde bare ett element når `onDragEnd` kjørte. Forsøket med `useCollectionViewStore.getState().selected` for å hente fersk state løste ikke problemet.

**Uklarhet:** Det er usikkert om årsaken er stale closure i dnd-kit's event dispatcher, en timing-konflikt mellom click-event og drag-aktivering (klikk på item kaller `selectOnly` og nullstiller multi-selection), eller noe annet.

---

## Forslag til fremtidig implementasjon

### Alternativ A: Unngå click-konflikten
Bruk en dedikert "select mode"-knapp eller toggle for å aktivere seleksjonsmodus. I seleksjonsmodus brukes plain klikk til å velge/velge bort, og drag er deaktivert. Utenfor seleksjonsmodus er drag aktivt som nå.

### Alternativ B: Drag handle
Legg til et separat drag-håndtak (f.eks. en grip-ikon øverst i hjørnet) som er det eneste stedet man starter drag. Resten av itemflaten brukes til klikk/seleksjon. Unngår all tvetydighet mellom click og drag.

### Alternativ C: Feilsøk stale closure
Wrap `onDragEnd` i `useCallback` med eksplisitte avhengigheter og sjekk om dnd-kit `DndContext` faktisk bruker siste versjon av callbacken. Legg til `console.log` for å verifisere innholdet av `selected` ved drag-start og drag-end.

### Alternativ D: Bytt til react-beautiful-dnd eller @hello-pangea/dnd
Disse bibliotekene har bedre dokumentert multi-drag-støtte og færre overraskende event-interaksjoner.

---

## Kodearkitektur som bør bevares

- `selectionSlice.ts` (`src/lib/`) er generisk og kan gjenbrukes
- Backend-endepunktet for batch-slett er klart
- Reorder-algoritmen for multi-move er korrekt (se commit-historikk)
