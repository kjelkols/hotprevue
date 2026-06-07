# ADR-023: Søkarkitektur

**Status:** Delvis implementert  
**Dato:** 2026-06-04

## Kontekst

Søk er et av de viktigste verktøyene i Hotprevue. En bruker med 50 000 bilder
kan ikke bla seg til et bilde — de må finne det. I dag finnes tre søke-innganger
som ikke henger godt sammen:

1. **Kriteriebygger** (`/searches/new`) — flat AND/OR på 7 felt
2. **AI-søk** (`/ai-search`) — fritekst mot CLIP-embeddings (ADR-022), helt separat
3. **BrowsePage** — ingen filterUI, men støtter kriterier via `usePhotoSource`

Problemene:
- Flat AND/OR-logikk kan ikke uttrykke `(tag=friluft ELLER tag=natur) OG vurdering >= 4`
- AI-søk kan ikke kombineres med strukturerte kriterier
- Lagrede søk er en flat liste uten rask tilgang
- Ingen filterUI i BrowsePage — man må forlate konteksten for å søke
- Manglende felt: GPS, samling, ansikt, EXIF-numeralia, kvalitet

## Beslutning

### 1. Kriteriemodell: flat med OR-grupper

Beholder flat AND/OR som toppnivå. Legger til én ekstra nivå: en **OR-gruppe** er
en enkelt rad i kriterielisten som inneholder to eller flere kriterier med
intern OR-logikk. Semantikken blir:

```
<top-AND> AND (<A> OR <B>) AND <C>    →  fullt uttrykk
<top-OR>  OR  (<A> AND <B>) OR <C>   →  om topplogikk er OR
```

Dette dekker godt over 95 % av praktiske spørringer uten kompleksiteten
i et fullt uttrykkstre. OR-grupper er et valgfritt tillegg — de fleste søk
bruker aldri denne funksjonen.

Implementasjon: `SearchCriterion` får valgfri `group`-egenskap (UUID).
Kriterier med samme `group` behandles som én OR-gruppe. Rekkefølgen i
UI bevares via `position`-heltall.

### 2. Utvidede søkefelt

Følgende felt legges til etter ADR-022 og ADR-021 er implementert:

| Felt | Operatorer | Krevd funksjonalitet |
|------|-----------|----------------------|
| `rating` | >=, <=, =, ikke satt | Eksisterer |
| `taken_at` | etter, før, mellom | Eksisterer |
| `tags` | en av, alle av, ingen av | Eksisterer |
| `photographer_id` | er, er ikke, **en av**, **ingen av** | Ny: multi-verdi |
| `event_id` | er, er ikke, ikke satt, **en av**, **ingen av** | Ny: multi-verdi |
| `camera_make` | er, inneholder | Eksisterer |
| `camera_model` | er, inneholder | Eksisterer |
| `collection_id` | er med i, ikke med i | Ny |
| `has_location` | ja, nei | Ny |
| `orientation` | portrett, landskap, kvadrat | Ny (avledet av width/height) |
| `file_extension` | er, er ikke | Ny |
| `quality_score` | >=, <=, ikke beregnet | Ny (ADR-021) |
| `face_cluster_id` | inneholder, inneholder ikke | Ny (ADR-022) |

Numeriske EXIF-felt (ISO, blenderåpning, lukkertid) vurderes ved behov,
men tas ikke nå — de er sjelden primærkriterium.

### 3. AI-søk integrert som søkesteg

CLIP-søk er ikke et filter — det er en rangeringsmekanisme som gir hvert
bilde en relevansverdi. Det modelleres som et **valgfritt postprosesseringssteg**
etter strukturert filtrering:

```
Strukturerte kriterier  →  kandidatsett  →  AI-rangering  →  resultat
```

På SearchPage legges en seksjon "AI-rangering" under kriteriebyggeren:
- Av som standard
- Slås på med et tekstfelt for fritekst-spørring (f.eks. "happy couple outdoors")
- En slider for "vis bare de N mest like" (standard 200)
- Krever at CLIP-embeddings er generert (ADR-022)

Lagrede søk kan inkludere AI-rangeringskonfigurasjonen. Søk uten AI-rangering
fungerer som i dag.

Den separate `/ai-search`-ruten beholdes midlertidig som enkel inn-gang for
ren semantisk søk, men peker mot SearchPage ved lagring.

### 4. Lagrede søk: dynamiske album

Et lagret søk er et **dynamisk album** — en gjenbrukbar spørring som gir
en fersk bildeoversikt hver gang den kjøres. Dette er mental modell som
kommuniseres konsekvent i UI.

**Datamodell (utvidelse av eksisterende `searches`-tabell):**

```sql
ALTER TABLE searches ADD COLUMN pinned       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE searches ADD COLUMN last_run_at  TIMESTAMPTZ;
ALTER TABLE searches ADD COLUMN last_count   INTEGER;
ALTER TABLE searches ADD COLUMN ai_query     TEXT;         -- CLIP-tekst
ALTER TABLE searches ADD COLUMN ai_top_n     INTEGER;      -- grense
```

**Listevisning** (`/searches`) viser:
- Navn
- Pinnede søk øverst, deretter sortert etter sist kjørt
- Antall bilder fra siste kjøring (med "utdatert"-indikator hvis > 1 time gammel)
- "Kjør"-knapp direkte på listekortet — åpner ikke editor, viser resultater inline
  i et panel som dekker halve skjermen (split-visning)
- Rediger-ikon → SearchPage

**Navigasjon:** Et punkt "Søk" i toppnavigasjonen (ved siden av eksisterende
Eventer, Samlinger, Tags) åpner `/searches`. Pinnede søk får egne snarveier
i en utfoldbar seksjon i navigasjonen.

### 5. Live søkeutførelse

Fjern "Kjør søk"-knappen. Søket oppdateres automatisk:
- 400 ms debounce etter siste endring i kriterier
- Tydelig "søker…"-tilstand (spinner i resultathodet)
- Tydelig "utdatert"-banner om AI-rangeringen er satt men embeddings mangler

For store resultatsett (> 2000 bilder) vises et advarselsbanner med
"Vurdér å legge til flere kriterier".

### 6. Kontekstuell filtrering i BrowsePage

BrowsePage får en **"Filter"-knapp** i toppraden (ved siden av ViewToggle).
Klikk åpner et kompakt panel over bilderutenettet — samme `SearchCriteriaBuilder`,
men uten navn og lagreknapp. Filteret er midlertidig (tilstanden lever i
komponenttilstanden, ikke i URL bortsett fra ved deling).

Filterkriteriene ANDes med eventuelle eksisterende begrensninger (event_id,
session_id, tag) som BrowsePage allerede mottar som URL-parametre.

Ønsker brukeren å lagre filteret → "Lagre som søk"-knapp i filterpanelet
sender brukeren til `/searches/new` med kriteriene forhåndsutfylt.

## Begrunnelse

**Flat med OR-grupper fremfor fullt uttrykkstre:** Et fullt tre (slik som SQL
WHERE-setninger) krever en komplisert trebygger i UI. OR-grupper gir
dobbelt uttrykkskraft for liten UX-kostnad — brukeren trenger knapt å
forstå at de eksisterer.

**AI som postprosessering fremfor eget kriterium:** CLIP-søk returnerer
relevansscorer for alle bilder, ikke et binært ja/nei. Det passer ikke
som et filterkriterie som ANDes med andre — det passer som en rangerings-
og nedskjæringsoperasjon på et allerede filtrert sett.

**Dynamisk album som mental modell:** Brukere forstår "dynamisk album" —
det er kjent fra Apple Photos smartalbumer og Lightroom smartsamlinger.
"Lagret søk" er et programmererbegrep; "dynamisk album" beskriver hva det er.

**Live oppdatering:** En dedikert "Kjør"-knapp er implisitt UI-gjeld —
den finnes fordi søket er tregt eller fordi utvikleren ikke stolte på
debounce. PostgreSQL med riktige indekser svarer på kriterier over 100 000
bilder på under 100 ms. Live oppdatering er riktig og enklere.

**Kontekstuell filtrering:** Brukeren er allerede i BrowsePage og vil
spesifisere. At de må navigere til en separat søkeside, skrive inn kriteriene
og komme tilbake, er unødvendig friksjon.

## Implementeringsstatus (per 2026-06-07)

| Del | Status |
|-----|--------|
| Pkt. 5 — Live søk, 400ms debounce, ingen «Kjør»-knapp | ✓ Implementert (via ADR-026) |
| Pkt. 2 — Søkefelt: rating, taken_at, photographer, event, camera | ✓ Implementert (6 av 13 felt) |
| Pkt. 1 — OR-grupper (`group`-egenskap på SearchCriterion) | ✗ Ikke implementert |
| Pkt. 2 — Manglende felt: tags, collection, location, orientation, quality, EXIF, face | ✗ Ikke implementert |
| Pkt. 3 — AI-søk integrert som postprosesseringssteg | ✗ Ikke implementert |
| Pkt. 4 — Dynamiske album (pinned, last_run_at, last_count, ai_query) | ✗ Ikke implementert |
| Pkt. 6 — Kontekstuell filtrering i BrowsePage | ✗ Ikke implementert |

---

## Konsekvenser

### Hva som gjenstår

**Backend:**
1. Migrering: `group`-kolonne på `searches`-kriterie-JSON (eller separat
   `search_criteria`-tabell om JSON ikke er tilstrekkelig) + `pinned`,
   `last_run_at`, `last_count`, `ai_query`, `ai_top_n` på `searches`
2. Søkemotor: støtte for OR-grupper i SQL-generering
3. Ny søkemotor: CLIP post-prosesseringssteg (vector similarity mot
   `ai_clip_embeddings`, sorterer og begrensnr resultatsett fra SQL-spørring)
4. `PATCH /searches/{id}/pin` (toggle)
5. Resultatoppdatering: `last_run_at` og `last_count` skrives ved kjøring

**Frontend:**
6. `SearchCriterion`-type: legg til valgfri `group: string`
7. `SearchCriteriaBuilder`: OR-gruppe-UI (dra-og-slipp eller manuell knapp)
8. `searchFields.ts`: nye felt og operatorer (se tabell over)
9. `SearchPage`: fjern "Kjør søk"-knapp, legg til AI-rangeringsseksjon
10. `SavedSearchesPage`: pin-ikon, antall-badge, inline "Kjør"-knapp, split-visning
11. Toppmeny / navigasjon: "Søk"-lenke + pinnede snarveier
12. `BrowsePage`: "Filter"-knapp og midlertidig kriteripanel

### Ikke i scope for denne ADR-en

- Deling av søk mellom brukere
- Abonnement/varsel når et søk gir nye resultater (push-notifikasjon)
- Fritekstsøk på bildetekster/AI-captions (vurderes i ADR-022-oppfølger)
- Geodistansebasert søk ("bilder innen 5 km fra Oslo")
- Sorteringsvalg utover standardrekkefølge (tatt_at desc)
