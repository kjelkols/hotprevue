# ADR-029: UI for visningskorreksjoner

**Status:** Implementert  
**Dato:** 2026-06-05

## Kontekst

`PhotoCorrection`-tabellen og API-endepunktene for korreksjoner ble implementert i
ADR-028. Det gjenstår å bestemme hvordan brukeren eksponeres for disse verktøyene
i UI-et. Korreksjonene er ikke-destruktive og retter registreringstidsfeil (gal
orientering, speilvendt skanning, skjev horisont, feil eksponering, skannet
border). De er ikke ment som et fullverdig bilderedigeringsverktøy.

## Analyse

De fleste seriøse verktøy (Lightroom, Darktable) separerer browsing og redigering
i egne moduser. For et *organisasjonsverktøy* med enkle korreksjoner er det
imidlertid naturlig med lavere terskel. Scanning-software (Faststone, ACDSee,
XnView) er nærmere sammenligningsgrunnlaget: de viser ↻/↺ på thumbnail-hover fordi
feil orientering er den hyppigste feilen og rask å bedømme selv på 150px.

For krop, horisont og eksponering er fulloppløst forhåndsvisning nødvendig — disse
verktøyene hører ikke hjemme på thumbnail-nivå.

## Beslutning: tre tilgangsnivåer

### Nivå 1 — Hover-knapper på thumbnail (BrowseView)

Kun **↻** og **↺** (rotér ±90°). Ikke flip, krop eller eksponering.

Knappene vises ved hover i hjørnet av `ThumbnailShell` (via ny `actions`-prop).
Kaller `PATCH /photos/{hothash}/correction` med beregnet ny rotasjon:
`(current + 90) % 360`. Ingen navigasjon til detaljvisning nødvendig.

CSS-transform (`rotate()`) fra `photo.rotation` i `PhotoListItem` holder
thumbnail-visningen riktig orientert uten ekstra API-kall.

### Nivå 2 — Correction-panel i PhotoDetailPage

Nytt avsnitt øverst i høyre sidebar (`PhotoMetaPanel`), alltid synlig.
Bruker `CorrectionPanel`-komponenten i `mode='full'`.

| Gruppe | Kontroll |
|--------|----------|
| **Rotasjon** | ↺ 90° · ↻ 90° · 180° |
| **Flip** | ↔ speilvend (toggle) |
| **Horisont** | Slider ±15°, 0.5°-steg, debounced |
| **Eksponering** | Slider ±2.0 EV, 0.1-steg, debounced |
| **Crop** | Fire sliders 0–30% per kant |
| **Auto enhance** | Én knapp — se avsnitt under |
| **Nullstill alt** | `DELETE /photos/{hothash}/correction` |

Coldpreview-bildet oppdateres ved å legge `?t=<correction.updated_at>`-parameter
på URL-en. `CorrectionPanel` bruker `qc.setQueryData(['photo', hothash], result)`
i stedet for `invalidateQueries` — dette oppdaterer React Query-cachen *umiddelbart*
med det returnerte `PhotoDetail`-objektet, slik at `coldpreviewUrl` endres
i samme render-syklus uten å vente på en ekstra nettverksforespørsel.

I tillegg bruker `CorrectionPanel` `qc.setQueriesData` for å skrive det oppdaterte
`PhotoDetail`-objektet (som er et supersett av `PhotoListItem`) direkte inn i alle
`['photos', ...]`-sider i cachen. Dette er nødvendig fordi listen har `staleTime: 30s`
og er inaktiv (umontert) mens brukeren er i detaljvisningen — `invalidateQueries`
alene vil ikke trigge refetch før komponenten mountes igjen, og da vises gammel
thumbnail-orientering i mellomtiden. Med `setQueriesData` er thumbnail riktig
orientert umiddelbart når brukeren går tilbake.

`DELETE`-mutasjonen (nullstill alt) nullstiller korreksjonsfeltene manuelt i
listecachen (`has_correction: false`, `rotation: null`, etc.) og invaliderer
deretter begge spørringene.
Sliders debounces ~400 ms for å unngå for hyppige API-kall.

### Nivå 3 — Popup fra BrowseView-kontekstmeny

"Korriger bilde…" i kontekstmenyen åpner et Radix Dialog. Inneholder:
- Forhåndsvisning (coldpreview, ~350px bred)
- Rotasjon + flip-knapper (komplett sett)
- Ingen crop/horizon/exposure — disse krever fullskjerm for nyttig feedback

Bruker `CorrectionPanel`-komponenten i `mode='compact'`.

## Auto enhance

Beregnes i frontend fra eksisterende kvalitetsfelter i `PhotoListItem`
(`exposure_mean`, `exposure_clipping`) — ingen ny backend-endpoint nødvendig.

```
foreslått_ev = -((exposure_mean - 128) / 128) * 1.2   // skalert mot ±1.5 EV maks
hvis exposure_clipping > 0.05: demper ev-forslaget 20%
```

Resultatet sendes til `PATCH /photos/{hothash}/correction` som `exposure_ev`.
Kan flyttes server-side til `POST /photos/{hothash}/correction/auto` i en
fremtidig iterasjon dersom mer sofistikert histogram-analyse ønskes.

## Komponentstruktur

```
lib/
  photoTransform.ts            ← computePhotoTransformCSS(correction) — eneste
                                  kilde til CSS-transformasjonslogikk i frontend

features/photos/
  CorrectionPanel.tsx          ← delt komponent, mode: 'full' | 'compact'
  CorrectionSliders.tsx        ← sliders for horisont, eksponering, crop
  PhotoCorrectionDialog.tsx    ← Radix Dialog-wrapper rundt CorrectionPanel
  PhotoMetaPanel.tsx           ← <CorrectionPanel mode="full"> øverst

features/browse/
  PhotoThumbnail.tsx           ← hover-knapper (↻/↺), sender correction til shell
  ThumbnailShell.tsx           ← bruker computePhotoTransformCSS, correction-prop
```

`CorrectionPanel` eier React Query-mutasjonen (`updateCorrection`).
Ved suksess:
1. `setQueryData(['photo', hothash], result)` — oppdaterer detaljcachen umiddelbart
2. `setQueriesData({ queryKey: ['photos'] }, …)` — skriver korreksjonsfelt inn i alle
   sider i listecachen synkront, slik at thumbnail er riktig orientert uten å vente
   på refetch
3. `invalidateQueries(['photos'])` — sikrer at data til slutt hentes på nytt fra backend

### Crop-reset ved orientieringsendring

Crop-koordinater er lagret relativt til post-rotasjons-/flip-bildet. Endring av
`rotation` eller `flip_horizontal` invaliderer disse koordinatene. `CorrectionPanel`
nullstiller automatisk alle fire crop-felt i samme PATCH-kall som orienterings-
endringen. Dette hindrer at et usynlig, ugyldig crop-rektangel overlever en rotasjon.

## Konsekvenser

- Ingen nye backend-endepunkter for kjerne-funksjonaliteten (endepunktene
  finnes fra ADR-028)
- `ThumbnailShell`-endring er bakoverkompatibel (`actions` er valgfri)
- CSS-transform av thumbnails er gratis — alle korreksjonsfelt er i `PhotoListItem`
- `computePhotoTransformCSS` sikrer at thumbnail og coldpreview alltid bruker
  samme transformasjonsrekkefølge
- Sliders krever debouncing for å unngå API-overbelastning
- `flip_horizontal` er ikke eksponert på thumbnail-nivå — vanskelig å bedømme
  riktig på 150px, gjøres i detaljvisning eller dialog
- Horisontjustering vises ikke i thumbnails (se `photoTransform.ts`)

## Ikke i scope

- Frihånds-crop med drag-grensesnitt (enkle border-sliders holder for use-caset)
- Fargebalanse, metning, denoising (se ADR-028 — feil lag)
- Undo/redo — brukeren kan nullstille enkeltfelt eller alt
- Batch-korreksjon for flere bilder samtidig
