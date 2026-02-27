# Kontekstmeny og handlingssystem

## Oversikt

Kontekstmenyen er et sentralt system i Hotprevue. Den er tett koblet til seleksjonsstilstanden og erstatter behovet for verktøylinjer og skjulte handlingsknapper. All brukerinteraksjon utover navigasjon og seleksjon skjer via kontekstmeny eller SelectionTray.

---

## Kjente mønstre og navn

Systemet bygger på tre veletablerte designmønstre som erfarne utviklere kjenner igjen:

### Explorer Selection Model
Seleksjonsatferden — klikk, Ctrl+klikk, Shift+klikk — er identisk med Windows Explorer og macOS Finder. I UX-litteraturen kalles dette **spatial selection model**: objekter har en romlig plassering i et grid, og seleksjon opererer på rekker og regioner. Alle større bildeprogrammer med gridvisning bruker denne modellen:

| Program | Seleksjonsmodell | Kontekstmeny-arkitektur |
|---|---|---|
| Adobe Lightroom Classic | Explorer-modell | Globalt kommandosystem |
| Capture One | Explorer-modell | Globalt kommandosystem |
| digiKam (KDE) | Explorer-modell | Qt Action/Menu-rammeverk |
| Apple Finder | Explorer-modell | AppKit NSMenu (deklarativ) |
| Windows Explorer | Explorer-modell (opphavet) | Shell IContextMenu (COM) |

### Command Pattern (Gang of Four, 1994)
Hvert menyvalg er et **Command-objekt** — en handling innkapslet med id, etikett og en `action()`-funksjon. Kommandoobjektet er løsrevet fra komponenten som trigget det og fra UI-laget som viser det. Dette muliggjør gjenbruk av handlinger på tvers av kontekstmeny, tastatursnarveier og eventuelle verktøylinjer.

### Menu Service / Imperative Portal
Kontekstmenyen styres av et **globalt Zustand-lager** (`useContextMenuStore`). Komponenter kaller `openContextMenu({ items, position })` imperativt ved høyreklikk. Et enkelt overlay-komponent i `App.tsx` leser fra lageret og håndterer rendering, posisjonering og lukking.

Dette skiller seg fra **deklarativ** tilnærming (f.eks. Radix UI `ContextMenu` der hvert element eier sin meny), og tilsvarer det Eclipse kaller *Menu Service*, IntelliJ kaller *Action System*, og VS Code kaller *Contribution Points*. Felles for alle: én sentral instans håndterer menyene, mens komponenter bidrar med innhold.

I React-verdenen kalles dette mønsteret gjerne **Imperative Portal** — en overlay styrt av kall, ikke av render-treet.

**Hvorfor imperativt og ikke deklarativt?**
Menyinnholdet avhenger av global seleksjonstilstand. En deklarativ per-komponent-tilnærming ville krevd at hvert thumbnail kjente til seleksjonslageret, beregnet riktige handlinger selv, og koordinerte med andre thumbnails. Den imperative tilnærmingen lar `PhotoGrid` eller `PhotoThumbnail` lese seleksjonstilstand og kalle en sentral funksjon med ferdig beregnet innhold.

---

## Arkitektur

```
Bruker høyreklikker
        ↓
PhotoThumbnail.onContextMenu(event)
        ↓
  Leser useSelectionStore (er dette bildet valgt?)
        ↓
  Beregner items[] basert på kontekst
        ↓
openContextMenu({ items, position: { x, y } })
        ↓
useContextMenuStore (Zustand)
  open: true
  position: { x, y }
  items: [...]
        ↓
ContextMenuOverlay (i App.tsx)
  Rendres som portal over alt annet innhold
  Viser items med default-valg uthevet
        ↓
Bruker klikker på valg → item.action() → overlay lukkes
```

---

## Datatyper

```typescript
interface ContextMenuItem {
  id: string
  label: string
  action: () => void
  isDefault?: boolean   // Uthevet. Trigges ved Enter etter åpning.
  disabled?: boolean
}

type ContextMenuEntry = ContextMenuItem | { type: 'separator' }

interface ContextMenuStore {
  open: boolean
  position: { x: number; y: number }
  items: ContextMenuEntry[]
  openContextMenu: (payload: { items: ContextMenuEntry[]; position: { x: number; y: number } }) => void
  closeContextMenu: () => void
}
```

---

## Seleksjonstilstand og høyreklikk-matrise

| Seleksjonsstilstand | Høyreklikk på | Effekt på seleksjon | Menyinnhold |
|---|---|---|---|
| Ingenting valgt | Photo | Sett seleksjon til dette bildet | Enkeltbilde-meny |
| 1+ valgt | Photo **utenfor** seleksjon | Sett seleksjon til dette bildet | Enkeltbilde-meny |
| 1+ valgt | Photo **innenfor** seleksjon | Uendret | *(tom — fremtidig: batch-meny)* |
| Hva som helst | Bakgrunn (tomt område) | Uendret | *(fremtidig: sortering, visningsvalg)* |

**Merk:** Høyreklikk på et bilde utenfor seleksjon endrer alltid seleksjon til kun det bildet. Brukeren skal aldri oppleve at handlingene i menyen gjelder et annet bilde enn det som ble høyreklikket.

---

## Enkeltbilde-meny (første versjon)

Vises når ett enkelt bilde er kontekst:

| Valg | Default | Handling |
|---|---|---|
| Åpne | ✓ | Naviger til `/photos/:hothash` — PhotoDetailView |
| *(flere valg kommer)* | | |

Default-valget er uthevet visuelt og trigges ved Enter. På sikt: Kopier filsti, Åpne original i eksternt program, Legg til i kollektion, Slett, osv.

---

## Escape-prioritet

Escape-tasten håndterer tre tilstander i prioritert rekkefølge. Lytteren ligger i `App.tsx`:

```
Escape →
  1. Kontekstmeny er åpen → lukk meny (stopp videre handling)
  2. Seleksjon er ikke tom → tøm seleksjon (stopp videre handling)
  3. Ingenting → ingen effekt
```

---

## PhotoDetailView — spesifikasjon

Rute: `/photos/:hothash`

Utløses av "Åpne" i kontekstmenyen (default-valg). Kan også nås via direkte URL.

**Datagrunnlag:** `GET /photos/{hothash}` → `PhotoDetail` (allerede implementert i backend).

**Layout:**

```
┌──────────────────────────────────────────────────┐
│ ← Tilbake   [filnavn]            [forrige] [neste]│
├─────────────────────────┬────────────────────────┤
│                         │ Tidspunkt              │
│                         │ Kamera                 │
│    coldpreview          │ Eksponering            │
│    (object-contain,     │ Brennvidde             │
│     full høyde)         │ Tags                   │
│                         │ Event                  │
│                         │ Fotograf               │
│                         │ Kategori               │
│                         │ Rating                 │
│                         │ Filer (ImageFile-liste)│
└─────────────────────────┴────────────────────────┘
```

**Coldpreview-visning:**
- Viser korrigert coldpreview hvis `PhotoCorrection` finnes, ellers original
- `object-contain` — ingen cropping, hele bildet synlig
- Klikk på coldpreview: fremtidig fullskjerm

**Metadata-panel:**
- Tidspunkt formatert etter `taken_at_accuracy` (sekund/time/dag/måned/år)
- Kamera: `camera_make` + `camera_model`
- Eksponering: `shutter_speed` · `aperture` · `iso`
- Filnavn + filsti per ImageFile, med `is_master`-markering
- Advarsel hvis masterfil ikke finnes på disk

**Navigasjon:**
- "Forrige"/"Neste": navigerer i konteksten bildet ble åpnet fra (basert på `orderedHashes` fra seleksjonslageret eller siste BrowseView-data)
- "← Tilbake": `navigate(-1)` — returnerer til forrige visning

---

## Fremtidige kontekster

Systemet er designet for å utvides. Planlagte kontekster:

| Kontekst | Trigger | Fremtidige menyvalg |
|---|---|---|
| Batch (selection) | Høyreklikk innenfor seleksjon | Tagg, Vurder, Sett event, Sett fotograf, Slett, Lag kollektion |
| Event-liste | Høyreklikk på event | Rediger, Slett, Åpne |
| Collection-element | Høyreklikk i CollectionView | Flytt, Fjern, Legg til caption |
| Bakgrunn i BrowseView | Høyreklikk på tomt område | Sorter etter, Velg alle |

---

## Implementasjonsoversikt

| Fil | Innhold |
|---|---|
| `src/stores/useContextMenuStore.ts` | Zustand-lager med `open`, `position`, `items`, `openContextMenu`, `closeContextMenu` |
| `src/components/ui/ContextMenuOverlay.tsx` | Global overlay — posisjonering, keyboard-nav, klikk-utenfor lukking |
| `src/App.tsx` | Mountpoint for overlay + Escape-prioriteringslogikk |
| `src/features/browse/PhotoThumbnail.tsx` | `onContextMenu`-handler, seleksjonssjekk, itemberegning |
| `src/pages/PhotoDetailPage.tsx` | `/photos/:hothash` — coldpreview + metadata-panel |
| `src/api/photos.ts` | `getPhoto(hothash)` — wrapper for `GET /photos/{hothash}` |
