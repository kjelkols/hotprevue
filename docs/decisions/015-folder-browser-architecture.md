# ADR-015: Arkitektur for katalogbrowsing og filflytting

**Status:** Implementert (Alternativ A + PinButton). Alternativ C er planlagt.

---

## Kontekst

Hotprevue har flere steder der brukeren velger en katalog:
- **Kildevelg**: velg katalog å skanne (StepSetup, CopySection, Snarveier)
- **Destinasjonsvelg**: velg katalog å flytte filer til (Preorganisering)
- **Kontinuerlig navigasjon**: venstre panel i Preorganisering (FolderPanel)

Opprinnelig ble alle modaler løst med én komponent (`FileBrowser`) med voksende
props (`allowNewFolder`, `newFolderParent`, `directoriesOnly`, `onFolderCreated`).
Dette førte til patcher og uventede bivirkninger (ny mappe laget på feil sted).

---

## Beslutning: Alternativ A (gjeldende implementasjon)

Én delt hook + to spesialiserte modal-komponenter.

```
hooks/useBrowse.ts           — path-state, browseDirectory, volumes, shortcuts
components/DirectoryPicker   — modal for KILDEVELG (viser mapper + filer, ingen ny mappe)
components/DestinationPicker — modal for DESTINASJONSVELG (kun mapper, ny mappe under fast forelder)
```

### Semantikken er nå eksplisitt

| Komponent | Viser filer | Ny mappe | Forelder for ny mappe |
|---|---|---|---|
| `DirectoryPicker` | Ja | Nei | — |
| `DestinationPicker` | Nei | Ja | Alltid `newFolderParent` |

`FolderPanel` (venstre panel i Preorganisering) er ikke en modal og håndterer
sin egen browse-logikk direkte — den er en annen UI-mønster og passer ikke
modal-malen.

### Brukssteder

| Sted | Komponent |
|---|---|
| `StepSetup` (kildekatalog for skanning) | `DirectoryPicker` |
| `CopySection` (kortkopierings-destinasjon) | `DirectoryPicker` |
| `SettingsPage` (snarveg-sti) | `DirectoryPicker` |
| `PhotoFolderGrid` (flytt filer til) | `DestinationPicker` |

### PinButton — inline snarveiopprettelse

`DirectoryPicker` har fått en `PinButton`-komponent (📌) i header-raden,
ved siden av stidisplayet. Den lar brukeren pinne gjeldende mappe som snarvei
uten å forlate registreringsflyten og gå til Innstillinger → Snarveier.

**Interaksjon:**
- Ikke pinnett mappe: grå 📌 → klikk viser mappenavn (fast) + valgfritt etikettfelt
- Etikett fylles inn (f.eks. "mors bilder") → Enter/✓ oppretter snarvei
- Tom etikett → faller tilbake til mappenavnet som snarveinavn
- Allerede pinnett mappe: blå 📌 → klikk fjerner snarveien

Siden `useBrowse` bruker første snarvei som startpunkt når ingen sti er valgt,
vil nyopprettede pinner automatisk brukes som startpunkt ved neste åpning.

`PinButton` er en selvstendig komponent (`components/PinButton.tsx`) som
bruker React Query-cachen `['shortcuts']` — ingen prop-drilling.

---

## Fremtidig plan: Alternativ C (full lagdeling)

Når behovet oppstår (f.eks. FolderPanel trenger delt browse-logikk, eller
vi skal teste browse-logikk isolert), er neste steg:

### Lag 1 — Data: `useBrowse` (allerede implementert)
Ingen endring.

### Lag 2 — UI-primitiv: `FolderList`
```tsx
// components/FolderList.tsx
interface Props {
  data: BrowseResult
  onNavigate: (path: string) => void
  showFiles?: boolean          // default false
  onFileClick?: (path: string) => void  // fremtidig: åpne fil
}
```
Ren rendering av katalogliste uten Dialog-wrapper eller seleksjons-logikk.
Brukes av alle tre lag under.

### Lag 3 — Komponenter (bruker FolderList + useBrowse)

```
DirectoryPicker.tsx    — Dialog + useBrowse + FolderList (showFiles=true)
DestinationPicker.tsx  — Dialog + useBrowse + FolderList (showFiles=false) + ny-mappe-UI
FolderPanel.tsx        — Inline + useBrowse (ekstern path fra store) + FolderList
```

### Endringer fra Alternativ A til C

1. Opprett `components/FolderList.tsx`
2. Erstatt inline `browse.data?.dirs.map(...)` i begge pickers med `<FolderList>`
3. Refaktorer `FolderPanel` til å bruke `useBrowse` for volum-query og shortcuts,
   men beholde `currentDir` fra Zustand som ekstern path (ikke intern hook-state).
   Legg til `externalPath?: string` i `useBrowse` options for dette.
4. Slett duplisert rendering-kode fra DirectoryPicker og DestinationPicker.

### Merk om FolderPanel og ekstern path

`FolderPanel` navigerer via `setCurrentDir` i Zustand-storen, ikke via intern
hook-state. For å bruke `useBrowse` her trenger hooken en `externalPath`-option:

```ts
// useBrowse.ts — tillegg
interface Options {
  initialPath?: string
  externalPath?: string   // overstyrer intern state — brukes av FolderPanel
  enabled?: boolean
}
// Når externalPath er satt: resolvedPath = externalPath (ingen intern state)
```

---

## Alternativer som ble vurdert

**Alt B — modus-prop**: `mode: 'source' | 'destination'` på FileBrowser.
Forkastet: én komponent gjør fortsatt to ting, skjuler semantikk i en enum.

**Alt C direkte**: Full lagdeling fra starten.
Utsatt: mer refaktorering enn nødvendig for nåværende behov. Gjøres når
FolderPanel skal inn i det delte systemet.
