# ADR-036: Stack-implementering

**Status:** Planlagt  
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
  models/stack.py
  schemas/stack.py
  api/stacks.py
  services/stack_service.py
  alembic/versions/…_adr036_stacks.py

frontend/src/
  api/stacks.ts
  types/api.ts               # StackOut, StackKind
  features/browse/
    PhotoThumbnail.tsx        # stack-indikator
    StackExpander.tsx         # inline-ekspansjon i grid
  features/stacks/
    StackKindSelect.tsx       # kind-velger (dropdown)
    StackCreateFlow.tsx       # opprett stack fra utvalg
```
