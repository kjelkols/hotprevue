# ADR-036: Stack-implementering

**Status:** Implementert  
**Dato:** 2026-06-08

---

## Kontekst

Feltene `stack_id` og `is_stack_cover` er allerede definert på `photos`-tabellen
og finnes i den initielle migrasjonen, men stack-funksjonaliteten er aldri
implementert: ingen `stacks`-tabell, ingen API-endepunkter og ingen
frontend-støtte.

En stack er en visuell gruppering av bilder som på ulike måter representerer
det samme motivet eller capture-sekvensen. Det finnes flere distinkt ulike
grunner til å gruppere bilder i en stack:

- **Utvalg** — mange bilder av samme motiv der man vil velge det beste
- **Burst** — rask sekvens egnet for animasjon (GIF, video)
- **Panorama** — overlappende utsnitt egnet for sammensying
- **HDR** — eksponeringsbraketing egnet for HDR-merge
- **Fokus** — fokus-braketing egnet for focus stacking

Hotprevue skal ikke prosessere disse videre — kind-feltet er metadata om
*capture intent*, ikke et prosesseringsutløser. Det gir likevel verdifull
semantikk for søk, AI-jobber og fremtidig verktøyintegrasjon.

---

## Beslutning

### Stacks-tabell

Stacks innføres som en eksplisitt entitet med egen tabell. Den nåværende
implisitte modellen (bare `stack_id` UUID på `photos`) er utilstrekkelig fordi
stack-nivå-metadata — som kind — ikke har noe naturlig hjem uten redundans
eller fragile kovarianter på enkeltbildene.

```
stacks
──────────────────────────────────────────────────────────
id          UUID         PK
kind        TEXT         NOT NULL  DEFAULT 'selection'
created_at  TIMESTAMPTZ NOT NULL  DEFAULT now()
```

`photos.stack_id` blir en FK til `stacks.id` (`ON DELETE SET NULL`).
`photos.is_stack_cover` beholdes som i dag.

### Stack kind — system-definert vokabular

Kind er et **fast vokabular definert i koden**, ikke brukerdefinert (som
kind i ADR-034) og ikke fri form (som tags i ADR-035). Lagres som `TEXT NOT NULL`
i databasen — ingen PostgreSQL ENUM-type, som er tungvint å utvide:

```python
class StackKind(str, Enum):
    SELECTION = "selection"   # Standard: velge beste bilde av samme motiv
    BURST     = "burst"       # Rask sekvens — animasjonspotensial
    PANORAMA  = "panorama"    # Overlappende utsnitt — sammensyingspotensial
    HDR       = "hdr"         # Eksponeringsbraketing — HDR-merge-potensial
    FOCUS     = "focus"       # Fokus-braketing — focus stacking-potensial
```

`SELECTION` er default og tilordnes automatisk ved opprettelse hvis kind ikke
er oppgitt. Brukeren kan endre kind etterpå.

### API

| Metode | Endepunkt | Beskrivelse |
|--------|-----------|-------------|
| `POST` | `/stacks` | Opprett stack av ett eller flere bilder |
| `GET` | `/stacks` | List alle stacks med coverbilde, antall og kind |
| `GET` | `/stacks/{stack_id}` | Hent alle bilder i en stack |
| `PATCH` | `/stacks/{stack_id}` | Endre kind |
| `POST` | `/stacks/{stack_id}/photos` | Legg til ett bilde |
| `POST` | `/stacks/{stack_id}/photos/batch` | Legg til flere bilder (best-effort) |
| `DELETE` | `/stacks/{stack_id}/photos/{hothash}` | Fjern bilde fra stack |
| `PUT` | `/stacks/{stack_id}/cover/{hothash}` | Sett coverbilde |
| `DELETE` | `/stacks/{stack_id}` | Slett stack og løs opp alle bilder |

**Regler:**
- Et bilde kan kun tilhøre én stack. Forsøk på å legge til et bilde som allerede
  er i en annen stack avvises med 409.
- `is_stack_cover` auto-settes til det første bildet ved opprettelse. Hvis
  coveret fjernes settes det første gjenværende bildet automatisk som nytt cover.
- Fjernes siste bilde slettes stacken og `stack_id` nullstilles på bildet.

### Gallerivisning

I BrowseView vises bare `is_stack_cover`-bildet per stack. En stack-indikator
(ikon + antall) vises på thumbnailens hjørne. Klikk på indikatoren ekspanderer
stacken inline i gridet.

Unstackede bilder vises alltid uansett stack-filter.

---

## Logikk og visualisering

### Datapunkter på et bilde

Et bilde er alltid i én av tre tilstander:

| Tilstand | `stack_id` | `is_stack_cover` |
|----------|-----------|-----------------|
| Fritt | NULL | false |
| Stack-medlem | UUID | false |
| Stack-cover | UUID | true |

Invariant: Hver stack har nøyaktig ett cover til enhver tid. Stacken slettes
automatisk når siste bilde frigjøres.

---

### Visualisering i BrowseView

**Kollapset tilstand (standard):**

- Kun stack-cover vises i gridet. Ikke-cover-bilder er skjult.
- Stack-indikatoren (lags-ikon) vises i hjørnet på cover-thumbnailens.
- Indikatoren er klikkbar og ekspanderer stacken inline.
- Frie bilder vises alltid, uten indikator.

> **Status:** Filtrering av ikke-cover-bilder ut av gridet er ikke implementert.
> Backend returnerer foreløpig alle bilder inkludert ikke-cover-bilder i stack.
> Dette skal fikses ved å legge til `stacks_collapsed`-parameter i
> `GET /photos`-endepunktet.

**Ekspandert tilstand:**

Klikk på stack-indikatoren åpner et inline-panel i gridet (`col-span-full`)
direkte etter cover-bildet. Panelet viser:

- Header: kind-etikett (f.eks. «Utvalg») · antall bilder · «Oppløs stack» · «Lukk»
- Alle bilder i stacken som 100×100-thumbnails
- Hvert bilde har hover-overlay med:
  - «Cover»-knapp (kun for ikke-cover-bilder) — setter dette bildet som cover
  - «×»-knapp — fjerner bildet fra stacken

Klikk utenfor panelet lukker det ikke — brukeren bruker «Lukk»-knappen.
Ekspansjon av én stack kollapser automatisk en annen åpen stack.

---

### Operasjoner fra kontekstmenyen

Kontekstmenyen skiller mellom enkeltbilde og multi-utvalg. Hvilke
stack-operasjoner som er tilgjengelige avhenger av utvalgets sammensetning.

#### Opprett stack

**Trigger:** Høyreklikk → «Opprett stack» (multi-utvalg)

**Forutsetning:** Alle valgte bilder må være frie (`stack_id IS NULL`).

**Feil:** Hvis ett eller flere valgte bilder er i en stack, vises modal:
«N bilder er allerede i en stack. Fjern dem fra sin stack først.»
med kun [Avbryt]. Ingen automatisk frigjøring eller flytting.

**Resultat:**
- Ny stack opprettes med valgt kind (default: «Utvalg»)
- Første bilde i utvalget settes som cover
- Utvalget tømmes

#### Fjern fra stack

**Trigger:** Høyreklikk → «Fjern fra stack»

**Vises:**
- Enkeltbilde: kun hvis bildet er stack-*medlem* (ikke cover)
- Multi-utvalg: alltid synlig

**Forutsetning:** Ingen av de valgte bildene kan være stack-cover.

**Feil:** Hvis utvalget inneholder ett eller flere cover-bilder, vises toast:
«Stack-cover-bilder kan ikke fjernes individuelt. Bruk 'Oppløs stack' for å
oppløse hele stacken.»

**Resultat:**
- Valgte bilder frigjøres (`stack_id = NULL`, `is_stack_cover = false`)
- Stacks som mister alle bilder slettes automatisk
- Stacks som mister coveret, men fortsatt har bilder, tildeler første gjenværende
  bilde som nytt cover

#### Oppløs stack

**Trigger:** Høyreklikk → «Oppløs stack»

**Vises:**
- Enkeltbilde: kun hvis bildet er stack-*cover*
- Multi-utvalg: alltid synlig

**Forutsetning (validert av backend):**
1. Alle valgte bilder er i en stack (`stack_id IS NOT NULL`)
2. Alle valgte bilder er cover (`is_stack_cover = true`)
3. Alle valgte bilder tilhører nøyaktig én stack (samme `stack_id`)

**Feil (toast):**

| Brudd | Melding |
|-------|---------|
| Noen bilder er ikke i stack | «Noen bilder er ikke i en stack.» |
| Ikke-cover-bilder er med | «Utvalget inneholder individuelle stack-bilder. Velg kun stack-coveret.» |
| Bilder fra flere stacks | «Utvalget inneholder flere stacks. Velg bilder fra én stack av gangen.» |

**Resultat:**
- Alle bilder i stacken frigjøres (`stack_id = NULL`, `is_stack_cover = false`)
- Stack-raden slettes
- Ingen bilder slettes — de er fortsatt synlige i gridet som frie bilder

---

### Operasjoner fra ekspander-panelet

Ekspander-panelet har egne knapper og opererer direkte på den åpne stacken.
Disse operasjonene bruker ikke utvalg-mekanismen.

| Knapp | Tilgjengelig for | Resultat |
|-------|-----------------|---------|
| «Cover» | Ikke-cover-bilder | Setter dette bildet som cover. Gammelt cover beholder plass i stacken. |
| «×» | Alle bilder inkl. cover | Fjerner bildet fra stacken. Siste bilde → stacken oppløses. Cover fjernet → første gjenværende blir nytt cover. |
| «Oppløs stack» | Alltid | Oppløser hele stacken. Alle bilder frigjøres. |

> **Merk:** I ekspander-panelet kan cover-bildet fjernes med «×». Dette er
> tillatt her (til forskjell fra «Fjern fra stack» fra kontekstmenyen) fordi
> cover-valget skjer interaktivt og direkte, og auto-cover-tilordning
> håndterer konsekvensen. Regelen «ingen cover via Fjern» gjelder batch-operasjoner
> fra utvalg, ikke enkelthandlinger i ekspandert visning.

---

### Regler for cover-invarianten

Coveret er alltid ett og nøyaktig ett per stack:

1. **Opprettelse:** Første bilde i hothash-listen settes som cover.
2. **Cover settes eksplisitt:** `PUT /stacks/{id}/cover/{hothash}` fjerner
   cover-flagg fra gammelt cover og setter det på det nye.
3. **Cover fjernes fra stack:** Første gjenværende bilde (etter fjerningsrekkefølge
   i databasen) settes automatisk som nytt cover.
4. **Siste bilde fjernes:** Stacken slettes. Ingen cover-tilordning nødvendig.

---

### Hva «Oppløs» ikke er

Oppløs er ikke det samme som sletting av bilder. Alle bilder i stacken overlever
som frie bilder i galleriet. Kun grupperingen (stack-raden og FK-koblingene)
fjernes. Termen «Slett stack» i StackExpander er unøyaktig og bør korrigeres til
«Oppløs stack» for å matche kontekstmenyen.

### Søk

`stack_kind` legges til som søkekriterium i `SavedSearch`-modellen. Eksempel:
*«vis alle panorama-stacker i dette eventet»*. Se ADR-023/026.

---

## Skillelinje mot Kind og Tag

| | Stack kind | Kind (ADR-034) | Tag (ADR-035) |
|---|---|---|---|
| Hvem definerer? | Systemet (kode) | Brukeren (admin) | Brukeren (fri form) |
| Hva beskrives? | Capture-relasjon mellom bilder | Motiv i ett bilde | Søkeverktøy på tvers |
| Kardinalitet | 1 per stack | 1 per bilde/event | N per bilde |
| Lagring | TEXT i `stacks` | FK til `kinds` | FK til `tags` |

Stack kind og photo kind er ortogonale: en burst-stack av portrettbilder har
`stack.kind = burst` og hvert bilde har `photo.kind = portrett`.

---

## Koblinger til planlagte funksjoner

**Kvalitet (ADR-021):** Innenfor en `selection`- eller `burst`-stack peker
`quality_score` mot det beste coverbilde-kandidaten. Naturlig fremtidig
funksjon: auto-forslag til cover basert på score.

**AI (ADR-022):** Stack kind er et signal for fremtidige AI-jobber: `burst` →
animasjonsforslag, `panorama` → detektere overlapp. Kind-feltet bør inngå i
`ai_sessions.scope`-vokabularet når dette implementeres.

**Collections:** Et ferdigprosessert resultat (sammensydd panorama, animert GIF
generert av et eksternt verktøy) kan legges inn i en collection som et eget
bilde. Stacken er kilde og metadata; collection-item er det realiserte
resultatet.

---

## Konsekvenser

**Gevinst:** Stack-konseptet får eksplisitt identitet i databasen og kan bære
fremtidig metadata. Kind-feltet gir søkbar semantikk om capture intent uten at
systemet forplikter seg til å prosessere det.

**Kostnad:** Migrasjonen innfører en `stacks`-tabell og endrer `photos.stack_id`
til en FK. Eksisterende rader med `stack_id IS NOT NULL` får innsatt tilsvarende
rader i `stacks` (kind settes til `'selection'` for alle).

---

## Filer

```
backend/
  models/stack.py                          # Stack-modell, StackKind enum
  schemas/stack.py                         # StackCreate, StackPatch, StackOut, StackDetail
  api/stacks.py                            # 11 endepunkter
  services/stack_service.py               # all forretningslogikk
  alembic/versions/a2b3c4d5e036_adr036_stacks.py
  tests/api/test_stacks.py

frontend/src/
  api/stacks.ts                            # alle API-kall
  types/api.ts                             # StackKind, StackOut, StackDetail, STACK_KIND_LABELS
  stores/useToastStore.ts                  # feilmeldingstoast
  components/ui/ToastOverlay.tsx           # toast-visning (montert i App.tsx)
  features/browse/
    PhotoGrid.tsx                          # expandedStackId-tilstand, StackExpander-injeksjon
    PhotoThumbnail.tsx                     # stack-indikator, kontekstmeny-operasjoner
    StackExpander.tsx                      # inline-ekspansjon med cover/fjern/oppløs
  features/stacks/
    StackCreateModal.tsx                   # opprett stack fra utvalg, konfliktdialog
```

### Kjente mangler / TODO

- **Browse-filtrering:** `GET /photos` returnerer alle bilder inkludert ikke-cover
  stack-bilder. Disse burde filtreres ut av grid i kollapset tilstand. Krever
  `stacks_collapsed`-parameter i `list_photos` og tilsvarende endring i
  `usePhotoSource`.
- **StackExpander «Slett stack»-knapp** bør omdøpes til «Oppløs stack».
- **Søk på stack_kind** er ikke implementert (se ADR-023/026).
- **Kvalitetsbasert cover-forslag** (ADR-021) ikke implementert.
