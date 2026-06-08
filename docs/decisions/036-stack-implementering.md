# ADR-036: Stack-implementering

**Status:** Implementert (UI under redesign — se 036-stack-ux-kladd.md)  
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

**Forutsetning:** Alle bilder må være frie (`stack_id IS NULL`).

**Feil (409):** Hvis ett eller flere bilder allerede er i en stack.

**Resultat:** Ny stack opprettes. Første bilde settes som cover.

### Fjern fra stack

**Endepunkt:** `POST /stacks/remove-photos`

**Forutsetning:** Ingen av bildene kan være stack-cover.

**Feil (400):** Hvis utvalget inneholder cover-bilder — bruk «Oppløs stack».

**Resultat:** Bildene frigjøres. Stacks som tømmes slettes. Stacks som mister
cover tildeler første gjenværende bilde som nytt cover.

### Oppløs stack

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

## Konsekvenser

**Gevinst:** Stack-konseptet får eksplisitt identitet i databasen. Enkel modell
uten kategoriseringsoverhead.

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
```

### TODO

- **Browse-filtrering:** `GET /photos` returnerer alle bilder inkludert
  ikke-cover stack-bilder. Krever `stacks_collapsed`-parameter i `list_photos`
  og `usePhotoSource`.
