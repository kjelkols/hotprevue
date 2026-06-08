# ADR-036: Stack-implementering

**Status:** Backend implementert. UI under implementasjon.  
**Dato:** 2026-06-08

---

## Kontekst

Feltene `stack_id` og `is_stack_cover` er allerede definert på `photos`-tabellen
og finnes i den initielle migrasjonen, men stack-funksjonaliteten er aldri
implementert: ingen `stacks`-tabell, ingen API-endepunkter og ingen
frontend-støtte.

En stack er en visuell gruppering av bilder som representerer det samme motivet
eller capture-sekvensen. Hotprevue kategoriserer ikke typen stack ytterligere —
stack er et rent visuelt organiseringsverktøy uten egne metadata utover tidsstempel.

---

## Beslutning

### Stacks-tabell

```
stacks
──────────────────────────────────────────────────────────
id          UUID         PK
created_at  TIMESTAMPTZ NOT NULL  DEFAULT now()
```

`photos.stack_id` er en FK til `stacks.id` (`ON DELETE SET NULL`).
`photos.is_stack_cover` markerer coveret.

### API

| Metode | Endepunkt | Beskrivelse |
|--------|-----------|-------------|
| `POST` | `/stacks` | Opprett stack av ett eller flere bilder |
| `POST` | `/stacks/remove-photos` | Fjern utvalgte bilder fra sine stacks (ikke cover) |
| `POST` | `/stacks/dissolve` | Oppløs stack via cover-bilde(r) |
| `GET` | `/stacks` | List alle stacks med coverbilde og antall |
| `GET` | `/stacks/{stack_id}` | Hent alle bilder i en stack |
| `POST` | `/stacks/{stack_id}/photos/{hothash}` | Legg til ett bilde |
| `POST` | `/stacks/{stack_id}/photos/batch` | Legg til flere bilder (best-effort) |
| `DELETE` | `/stacks/{stack_id}/photos/{hothash}` | Fjern bilde fra stack |
| `PUT` | `/stacks/{stack_id}/cover/{hothash}` | Sett coverbilde |
| `DELETE` | `/stacks/{stack_id}` | Oppløs stack og frigjør alle bilder |

---

## Datapunkter på et bilde

Et bilde er alltid i én av tre tilstander:

| Tilstand | `stack_id` | `is_stack_cover` |
|----------|-----------|-----------------|
| Fritt | NULL | false |
| Stack-medlem | UUID | false |
| Stack-cover | UUID | true |

Invariant: Hver stack har nøyaktig ett cover til enhver tid. Stacken slettes
automatisk når siste bilde frigjøres.

---

## Operasjoner

### Opprett stack

**UI-trigger:** Kontekstmeny → «Opprett stack» (aktivt når utvalget kun inneholder
frie bilder ≥ 2).

**Forutsetning:** Alle bilder må være frie (`stack_id IS NULL`).

**Feil (409):** Hvis ett eller flere bilder allerede er i en stack.

**Resultat:** Ny stack opprettes. Første bilde settes som cover.

### Legg til i stack

**UI-trigger:** Kontekstmeny → «Legg til i stack» (aktivt når utvalget inneholder
frie bilder + nøyaktig én stack).

De frie bildene legges inn i stacken som allerede er i utvalget. Ingen dialog.

### Fjern fra stack

**UI-trigger:** Kontekstmeny → «Fjern fra stack» (aktivt i ekspandert modus når
utvalget kun inneholder stack-*medlemmer*, ikke cover).

**Endepunkt:** `POST /stacks/remove-photos`

**Forutsetning:** Ingen av bildene kan være stack-cover.

**Resultat:** Bildene frigjøres. Stacks som tømmes slettes. Stacks som mister
cover tildeler første gjenværende bilde som nytt cover.

### Oppløs stack

**UI-trigger:** Kontekstmeny → «Oppløs stack» (aktivt når utvalget inneholder
nøyaktig én stack og ingen individuelle bilder).

**Endepunkt:** `POST /stacks/dissolve`

**Forutsetning:**
1. Alle bilder er i en stack
2. Alle bilder er cover
3. Alle bilder tilhører nøyaktig én stack

**Feil (400):**

| Brudd | Melding |
|-------|---------|
| Noen bilder ikke i stack | «Noen bilder er ikke i en stack.» |
| Ikke-cover-bilder med | «Utvalget inneholder individuelle stack-bilder. Velg kun stack-coveret.» |
| Bilder fra flere stacks | «Utvalget inneholder flere stacks. Velg bilder fra én stack av gangen.» |

**Resultat:** Alle bilder i stacken frigjøres. Stack-raden slettes. Ingen bilder
slettes — de lever videre som frie bilder.

---

## Regler for cover-invarianten

1. **Opprettelse:** Første bilde i hothash-listen settes som cover.
2. **Eksplisitt sett:** `PUT /stacks/{id}/cover/{hothash}` bytter cover.
3. **Cover fjernes:** Første gjenværende bilde tildeles automatisk som nytt cover.
4. **Siste bilde fjernes:** Stacken slettes.

---

## UI-strategi

### Kjerneprinsipper

**Disable fremfor feil.** Kontekstmenyen speiler tilstanden til utvalget. Menyvalg
er grå når forutsetningene ikke er oppfylt — ingen reaktive feilmeldinger, ingen
bekreftelsesdialoger.

**Stack som atomisk UI-element.** En stack er én kortstokk i gridet, ikke et sett
bilder som bare kepper seg annerledes.

### Visuell modell

**Kollapset (standard):**

- Cover-thumbnail med 2–3 forskjøvede «kort» bak (CSS transform — kortstokk-effekt)
- Antall-badge, f.eks. `×4`
- Hover (~350 ms) → popover med mikro-thumbnails (~48×48 px) og antall — kun lesing
- Klikk → velger stacken (cover-hothash som proxy)

**Ekspandert (via toggle «Ekspander stack» i verktøylinja):**

- Alle bilder i alle stacks vises, inkl. ikke-cover-bilder
- Stack-tilhørighet: subtle border/bakgrunn per stack (ulik farge per stack)
- Cover-bildet: `cover`-badge
- Hover på ikke-cover-bilde → tooltip med stackens cover-thumbnail
- Utvalg velger individuelle bilder

Togglen lagres i `useViewStore` og tømmer utvalget når den skifter tilstand.

### Kontekstmeny

Utvalget analyseres før menyen bygges:

| Utvalgssammensetning | Aktivt valg |
|---|---|
| Frie bilder ≥ 2, ingen stacks | **Opprett stack** |
| Frie bilder + nøyaktig én stack | **Legg til i stack** |
| Nøyaktig én stack, ingen andre | **Oppløs stack** |
| Stack-medlemmer (ikke-cover) i ekspandert modus | **Fjern fra stack** |
| Alt annet | Alle grå |

### Seleksjonsmodell

`useSelectionStore` holder `Set<string>` med hothashes — ingen endring.
Cover-hothash brukes som proxy for stacken i kollapset modus.

### Fase 2

- **«Merk stack»** — høyreklikk på stacket bilde i ekspandert modus → resetter
  utvalget og merker alle bilder i stacken
- **«Sett som cover»** — høyreklikk på ikke-cover-bilde i ekspandert modus

### Hover-popover

Popoveren viser de øvrige bildenes hotpreviews. For god responsivitet utvides
`StackOut` med `member_hotpreviews_b64: string[]` slik at alle previews er
tilgjengelige uten ekstra API-kall ved hover.

---

## Konsekvenser

**Gevinst:** Stack-konseptet får eksplisitt identitet i databasen. Enkel modell
uten kategoriseringsoverhead. UI-strategien unngår feildialoger ved å stenge
menyvalg basert på utvalgsanalyse.

**Kostnad:** Migrasjonen innfører en `stacks`-tabell og endrer `photos.stack_id`
til en FK. Eksisterende rader med `stack_id IS NOT NULL` får innsatt tilsvarende
rader i `stacks`.

---

## Filer

```
backend/
  models/stack.py
  schemas/stack.py
  api/stacks.py
  services/stack_service.py
  alembic/versions/a2b3c4d5e036_adr036_stacks.py
  alembic/versions/b3c4d5e6f037_drop_stack_kind.py
  tests/api/test_stacks.py

frontend/src/
  api/stacks.ts
  types/api.ts                  # StackOut, StackDetail
  features/browse/
    PhotoGrid.tsx               # grid-visning
    PhotoThumbnail.tsx          # stack-indikator (statisk, hover og kontekstmeny kommer)
```

### TODO

- **Browse-filtrering:** `GET /photos` returnerer alle bilder inkludert ikke-cover
  stack-bilder. Krever `stacks_collapsed`-parameter i `list_photos` og `usePhotoSource`.
- **Kortstokk-visning:** Kollapset stack-thumbnail med CSS-korteffekt.
- **Hover-popover:** `member_hotpreviews_b64` i `StackOut`, popover-komponent.
- **«Ekspander stack»-toggle** i verktøylinja, farging per stack i ekspandert modus.
- **Kontekstmeny med utvalgsanalyse:** Opprett / Legg til i stack / Fjern / Oppløs.
