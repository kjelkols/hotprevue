# Bildekategorisering — spec

## Konsept

Brukeren velger ett eller flere bilder i en BrowseView-kontekst og tilordner dem til en destinasjon. Destinasjonen velges i øyeblikket handlingen utføres — ikke på forhånd.

**Gjelder kun BrowseView.** Batch-tilordning av metadata er ikke tilgjengelig i CollectionView. CollectionView har sitt eget separate operatorsett (se nedenfor).

---

## To separate operatorsett

Systemet har to kontekster med hvert sitt lukkede sett av operasjoner. De deler ikke logikk, tilstand eller UI-komponenter utover PhotoThumbnail.

### BrowseView — organisering

Opererer på Photos sine *metadata*. Bilder er uordnede. Avkryssingstilstand aktivt.

| Operasjon | Destinasjon | API |
|---|---|---|
| Sett event | Event (ett bilde tilhører maks ett event) | `POST /photos/batch/event` |
| Legg til i samling | Collection (ved InsertionPoint eller slutten) | `POST /collections/{id}/items/batch` |
| Sett fotograf | Fotograf | `POST /photos/batch/photographer` |
| Vurder | Rating 1–5 eller fjern | `POST /photos/batch/rating` |
| Slett | Soft delete | `POST /photos/batch/delete` |

### CollectionView — presentasjon

Opererer på *CollectionItems*, ikke på Photos direkte. Rekkefølge er semantisk meningsfull. Avkryssingstilstand ikke tilgjengelig.

| Operasjon | Hva | API |
|---|---|---|
| Flytt element | Endre rekkefølge (drag-drop) | `PUT /collections/{id}/items` |
| Sett caption | Bildetekst under foto i visningsmodus | `PATCH /collections/{id}/items/{item_id}` |
| Sett notes | Forelesningsnotater (skjult for publikum) | `PATCH /collections/{id}/items/{item_id}` |
| Legg til tekstkort | Markdown-slide mellom bilder | `POST /collections/{id}/items` |
| Fjern fra samling | Fjerner CollectionItem, photo berøres ikke | `DELETE /collections/{id}/items/batch` |
| Sett InsertionPoint | Angir innsettingspunkt for nye elementer | (klient-state) |

**Collection kan ikke være kilde.** Det gir ingen mening å hente bilder *fra* en collection for å tilordne dem til events eller tags — collection er et presentasjonsprodukt bygd av allerede organiserte bilder.

---

## Arbeidsflyt — BrowseView

```
Bla i en BrowseView-kontekst
(event, søk, fotograf, sesjon, alle bilder)
          ↓
Velg bilder (klikk / Ctrl / Shift / Ctrl+A)
          ↓
  ┌───────┴──────────┐
  ▼                  ▼
Høyreklikk       SelectionTray
på utvalg        "Legg til i…"
  └───────┬──────────┘
          ▼
    PickerModal
    (søkbar liste)
          ↓
   Velg destinasjon
          ↓
      Handling utføres
          ↓
   Utvalg tømmes
```

---

## Triggere

### 1. Kontekstmeny — høyreklikk innenfor utvalg (BrowseView)

| Menyvalg | Åpner |
|---|---|
| Sett event… | EventPickerModal |
| Legg til i samling… | CollectionPickerModal |
| Sett fotograf… | PhotographerPickerModal |
| Vurder → | Undermeny: ★ / ★★ / ★★★ / ★★★★ / ★★★★★ / Fjern |
| Slett | Bekreftelsesdialog |

Se `context-menu.md` for kontekstmeny-arkitektur og CollectionView sin separate meny.

### 2. SelectionTray — "Legg til i…"-knapp (BrowseView)

Bunnlinjen viser "Legg til i…"-knapp når `selected.size > 0`. Knappen åpner en popover med to valg: Event, Samling. Hvert valg åpner tilsvarende picker-modal.

SelectionTray er ikke tilgjengelig i CollectionView.

---

## Picker-modaler

Alle tre modalene følger samme mønster:

```
┌────────────────────────────────┐
│  [Søkefelt]                    │
│  ──────────────────────────    │
│  ○ Sommerfest 2025             │
│  ○ Julefest 2024               │
│  ○ Bursdag Jonas               │
│  ──────────────────────────    │
│  [Avbryt]        [Bekreft →]   │
└────────────────────────────────┘
```

- **Søkefelt**: filtrerer listen fortløpende, autofokus ved åpning
- **Liste**: scrollbar ved mange elementer, radioknapper (ett valg)
- **Bekreft**: disabled inntil ett element er valgt

### EventPickerModal

- Henter `GET /events`
- Operasjon: `POST /photos/batch/event` med `{ hothashes, event_id }`
- Semantikk: bilder *flyttes* — ett bilde tilhører maks ett event

### CollectionPickerModal

- Henter `GET /collections`
- Operasjon: `POST /collections/{id}/items/batch` med `{ hothashes }`
- Innsetting skjer ved InsertionPoint hvis brukeren er inne i den aktuelle CollectionView, ellers på slutten
- Semantikk: bilder *legges til* — ett bilde kan være i mange samlinger

> **Merk:** TagPickerModal er fjernet (ADR-035, fase 1). Ny tags-tildeling planlagt i fase 2.

---

## Etter handling

1. Utvalget tømmes (`useSelectionStore.clear()`)
2. Relevante queries invalideres: `['photos']`, og `['events']` / `['collections']`
3. Modal lukkes
4. Brukeren forblir i samme visning

---

## Komponenter

| Fil | Innhold |
|---|---|
| `src/features/assignment/EventPickerModal.tsx` | Modal med event-liste og søk |
| `src/features/assignment/CollectionPickerModal.tsx` | Modal med samlings-liste og søk |
| `src/features/assignment/AssignButton.tsx` | "Legg til i…"-knapp med popover (til SelectionTray) |
| `src/features/selection/SelectionTray.tsx` | Bunnlinje — ingen NavigationStore-avhengighet |

Kontekstmeny-handlinger registreres i `PhotoThumbnail.tsx` via `openContextMenu`.
