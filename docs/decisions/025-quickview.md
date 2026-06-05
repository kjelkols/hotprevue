# ADR-025: QuickView — ikke-interaktivt tettgrid for store bildesett

**Status:** Forslag  
**Dato:** 2026-06-05

---

## Kontekst

Søk og dynamiske album kan returnere store resultatsett — typisk 500–5 000 bilder,
men potensielt 20 000+. Det eksisterende `PhotoGrid` er ikke egnet for dette:

1. **Én React-komponent per bilde.** `PhotoThumbnail` abonnerer på fire Zustand-stores
   (selection, contextMenu, assignment, photoNav). Ved 2 000 bilder er det 8 000
   aktive store-abonnementer i tillegg til et like stort antall DOM-noder.

2. **Re-renders ved seleksjonsbytte.** Hver gang ett bilde velges, evaluerer alle
   thumbnails om de er valgt. Med `Set`-sammenligning er dette billig per komponent,
   men 2 000 samtidige evalueringer gir merkbar forsinkelse.

3. **Interaktiviteten er overflødig i søkekonteksten.** Søk brukes til å finne og
   vurdere et bildesett — ikke til å redigere det. Utvalg, kontekstmeny og
   tildeling er ikke relevante handlinger mens man formulerer et søk.

`PhotoGrid` løser bruksmønsteret for BrowsePage (redigering, tildeling, seleksjon).
Det løser *ikke* bruksmønsteret for SearchPage (oversikt, hurtigvurdering, navigasjon).

---

## Beslutning

### Nytt komponent: `<QuickView>`

```tsx
<QuickView photos={PhotoListItem[]} />
```

Gjenbrukbar, selvstending komponent uten avhengighet til seleksjons- eller
tildelingslogikk. Primær bruk: høyre panel i SearchPage (ADR-023). Sekundær
bruk: inline visning i SavedSearchesPage og BrowsePage filter-panel.

### 1. Bildekilde: hotpreview_b64

Hotpreview (150×150 px, base64) er allerede del av `PhotoListItem`-responsen.
QuickView gjengir bildene som `<img src="data:image/jpeg;base64,…">` — ingen
ekstra HTTP-forespørsler, bilder tilgjengelige øyeblikkelig.

Bildene vises i 80 px celler. Det gir ~3,5× tettere grid enn PhotoGrid (150 px)
og lar brukeren se ca. 150–300 bilder per skjermside avhengig av skjermstørrelse.

### 2. CSS-virtualisering: `content-visibility: auto`

Virtualisering håndteres av nettleseren via CSS-egenskapen `content-visibility: auto`
med `contain-intrinsic-size` satt til cellehøyden. Nettleseren hopper over
rendering av rader utenfor viewport.

```css
.qv-row {
  content-visibility: auto;
  contain-intrinsic-size: auto 80px;
}
```

**Fordeler fremfor JS-virtualisering (react-window):**
- Ingen avhengighet å vedlikeholde
- Scrollhendelser forblir synkrone — ingen "white flash" ved rask scrolling
- Enkel implementasjon (~10 linjer)
- Tilstrekkelig for enkeltbruker-størrelser (< 50 000 bilder)

Fallback: Dersom fremtidig ytelsesmåling viser utilstrekkelig ytelse ved 50 000+
bilder, kan implementasjonen byttes til react-window uten å endre komponent-API.

Radstørrelse: 20 bilder per rad (fast antall, beregnet fra fast cellebredde 80 px).
Cellene justeres med CSS Grid.

### 3. Null Zustand-abonnementer

QuickView importerer ingen stores. Ingen utvalg, ingen kontekstmeny, ingen
tildeling. Dette er et bevisst design — ikke en mangel.

Konsekvens: seleksjonsbokser vises ikke, høyreklikk gir ingen meny.

### 4. Navigasjon til detaljvisning

Klikk på et bilde åpner `PhotoDetailPage` via `usePhotoNavStore` (sett hothashes,
backUrl) — nøyaktig samme mekanisme som `PhotoThumbnail.handleDoubleClick`.

I QuickView er det enkelt klikk (ikke dobbeltklikk) siden det ikke er noe
seleksjonsmodus å skille fra.

### 5. Ytelsestak og advarselsbanner

QuickView rendres som én flat liste. For resultatsett over 10 000 bilder vises
et informasjonsbanner:

> «Viser de første 10 000 bildene. Legg til flere kriterier for å snevre inn.»

API-en paginerer allerede — dette er en grense på klientsiden for å beskytte
nettleseren mot ekstremt store base64-akkumuleringer i minnet.

---

## Begrunnelse

**CSS-virtualisering fremfor react-window:** `content-visibility: auto` er støttet
i alle moderne nettlesere og krever ingen JS. For scroll-tung bruk (500–5 000 bilder)
er ytelsen sammenlignbar med windowing, men uten implementasjonskompleksiteten.
react-window krever at rader har kjent høyde på forhånd — trivielt her, men er
et ekstra constraint. CSS-løsningen er lettere å vedlikeholde.

**80 px celler fremfor enda mindre:** Under 60 px blir hotpreviews (150×150)
for uklare til å identifisere motiv. 80 px er minsteterskel for rask gjenkjenning.
Brukeren kan ikke endre cellestørrelse i QuickView — det finnes ingen ViewStore
her.

**Enkelt klikk fremfor dobbeltklikk:** Siden det ikke finnes seleksjonsmodus i
QuickView er det ingen grunn til å reservere enkelt klikk for seleksjon. Direkte
åpning er raskere og mer naturlig.

**Ingen tildelingsoperasjoner:** Den naturlige flyten etter et søk er å finne
bilder og deretter åpne dem i detaljvisning eller navigere til BrowsePage/EventPage
for redigering. Å eksponere tildeling direkte i søkeresultatene øker kompleksiteten
uten å forkorte den faktiske arbeidsflyten vesentlig.

---

## Konsekvenser

### Frontend

1. **Nytt komponent** `src/features/browse/QuickView.tsx`:
   - Props: `photos: PhotoListItem[]`, `isLoading: boolean`
   - Rendrer CSS Grid med 80 px celler og `content-visibility: auto` per rad
   - Håndterer klikk med event delegation (én lytter på grid-container)
   - Sett `usePhotoNavStore.hothashes` og `backUrl` ved klikk

2. **SearchPage** bruker `QuickView` i høyre panel (del av ADR-023-implementasjonen)

3. **SavedSearchesPage** kan bruke `QuickView` for inline visning (fremtidig)

4. **PhotoGrid og PhotoThumbnail** endres ikke — de forblir primær komponent
   for BrowsePage der interaktivitet er nødvendig

### Ikke i scope

- Zooming/forstørring av enkeltbilder i QuickView (åpne PhotoDetailPage i stedet)
- Seleksjon eller batch-operasjoner i QuickView
- Sorteringsvalg (rekkefølge arves fra søkeresultatet)
- Gruppering etter dato (unødvendig overhead for hurtig oversikt)
