# ADR-036: Stack-implementering

**Status:** Implementert  
**Dato:** 2026-06-08

---

## Kontekst

Feltene `stack_id` og `is_stack_cover` er allerede definert på `photos`-tabellen
og finnes i den initielle migrasjonen, men stack-funksjonaliteten er aldri
implementert: ingen `stacks`-tabell, ingen API-endepunkter og ingen
frontend-støtte.

En stack er en visuell gruppering av bilder som representerer det samme motivet
eller capture-sekvensen — for eksempel mange bilder av samme motiv der man vil
velge det beste, burst-sekvenser, bracketing-serier, eller overlappende panorama-utsnitt.

Hotprevue kategoriserer ikke typen stack ytterligere. Stack er et rent
visuelt organiseringsverktøy uten egne metadata utover tidsstempel.

---

## Beslutning

### Stacks-tabell

Stacks innføres som en eksplisitt entitet med egen tabell:

```
stacks
──────────────────────────────────────────────────────────
id          UUID         PK
created_at  TIMESTAMPTZ NOT NULL  DEFAULT now()
```

`photos.stack_id` blir en FK til `stacks.id` (`ON DELETE SET NULL`).
`photos.is_stack_cover` beholdes som i dag.

### API

| Metode | Endepunkt | Beskrivelse |
|--------|-----------|-------------|
| `POST` | `/stacks` | Opprett stack av ett eller flere bilder |
| `GET` | `/stacks` | List alle stacks med coverbilde og antall |
| `GET` | `/stacks/{stack_id}` | Hent alle bilder i en stack |
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

- Header: antall bilder · «Oppløs stack» · «Lukk»
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
- Ny stack opprettes
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
fjernes.

---

## Konsekvenser

**Gevinst:** Stack-konseptet får eksplisitt identitet i databasen. Enkel og
fokusert modell uten kategoriseringsoverhead.

**Kostnad:** Migrasjonen innfører en `stacks`-tabell og endrer `photos.stack_id`
til en FK. Eksisterende rader med `stack_id IS NOT NULL` får innsatt tilsvarende
rader i `stacks`.

---

## Filer

```
backend/
  models/stack.py                          # Stack-modell
  schemas/stack.py                         # StackCreate, StackOut, StackDetail
  api/stacks.py                            # 10 endepunkter
  services/stack_service.py               # all forretningslogikk
  alembic/versions/a2b3c4d5e036_adr036_stacks.py
  alembic/versions/b3c4d5e6f037_drop_stack_kind.py
  tests/api/test_stacks.py

frontend/src/
  api/stacks.ts                            # alle API-kall
  types/api.ts                             # StackOut, StackDetail
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
- **Kvalitetsbasert cover-forslag** (ADR-021) ikke implementert.
