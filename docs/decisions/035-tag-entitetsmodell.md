# ADR-035: Tags som entitetsmodell med forvaltnings-UI

**Status:** Implementert  
**Dato:** 2026-06-07

---

## Kontekst

Tags er i dag lagret som `ARRAY(String)` direkte på `photos`-tabellen. En tag
eksisterer ikke som en selvstendig entitet — den «oppstår» første gang den settes
på et bilde og «forsvinner» når ingen bilder lenger har den. `GET /tags` er en
live-aggregering via `unnest`.

Modellen fungerer for enkel tildeling og filtrering, men er utilstrekkelig for
tre nye krav som nå er identifisert:

**Hindre overlappende tags.** Brukere oppretter «portrett», «portretter» og
«portrettfoto» som tre separate tags fordi det ikke finnes noe som advarer om
lignende eksisterende tags ved input. Over tid vokser samlingen med nær-duplikater
som fragmenterer søkeresultater.

**Sammenslåing.** Når duplikater allerede eksisterer må de kunne slås sammen.
Med array-modellen er merge en `array_replace`-oppdatering over hele `photos`-tabellen
som ikke er atomisk og ikke håndterer bilder som allerede har begge tags.

**Full forvaltning.** En tags-fane krever stabil identitet per tag for rename,
slett og merge uten å stole på at strengverdien er unik og uforanderlig.

Alle tre krav forutsetter at tags har en kanonisk identitet i databasen.

---

## Beslutning

Innfør en **`tags`-tabell** med tilhørende **`photo_tags`-koblingstabell**, og
erstatt `photos.tags ARRAY(String)` med denne modellen.

### Datamodell

```
tags
──────────────────────────────────────
id          UUID  PK
name        TEXT  NOT NULL
slug        TEXT  NOT NULL  UNIQUE
created_at  TIMESTAMPTZ  NOT NULL  DEFAULT now()
```

```
photo_tags
──────────────────────────────────────
photo_id    UUID  FK → photos.id  ON DELETE CASCADE
tag_id      UUID  FK → tags.id    ON DELETE CASCADE
PRIMARY KEY (photo_id, tag_id)
```

`slug` = `name.strip().lower()` med mellomrom normalisert til enkelt mellomrom.
`UNIQUE`-constraint på slug hindrer eksakte duplikater på databasenivå.

### Likhetsindeks for fuzzy-søk

```sql
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX ix_tags_name_trgm ON tags USING gin (name gin_trgm_ops);
```

Brukes ved oppretting: `SELECT name, similarity(name, :input) AS sim FROM tags
WHERE similarity(name, :input) > 0.3 ORDER BY sim DESC LIMIT 6`.

### Migrering av eksisterende data

Alembic-migrasjonen:

1. Aktiver `pg_trgm`-utvidelse
2. Opprett `tags` og `photo_tags`
3. Løft ut alle unike strenger fra `photos.tags` → insert i `tags` (slug = lower)
4. Insert koblingsrader i `photo_tags`
5. Dropp `photos.tags`-kolonnen

### Batch-operasjoner

Eksisterende batch-API beholdes med samme endepunkt-URL, men implementasjonen
endres internt til å operere mot `photo_tags`. Ingen frontend-endringer for
eksisterende tildeling.

### Merge-operasjon (ny)

```
POST /tags/{source_id}/merge-into/{target_id}
```

Én transaksjon:

1. `UPDATE photo_tags SET tag_id = :target WHERE tag_id = :source`
2. Slett eventuelle duplikater (samme `photo_id` med `tag_id = :target` to ganger)
3. `DELETE FROM tags WHERE id = :source`

---

## Tags-fane

### To lag i samme panel

Fanen viser alltid hele tag-listen. Tresinnstilstanden er aktiv når bilder er valgt:

| Ikon | Betyr |
|------|-------|
| ✓ fylt | Alle valgte bilder har taggen |
| – dash | Noen valgte bilder har taggen (mixed) |
| □ tom | Ingen valgte bilder har taggen |

Klikk på ✓ eller – → fjern fra alle valgte  
Klikk på □ → legg til på alle valgte

**Lag 1 — Forvaltning** (alltid synlig):
Liste over alle tags med antall bilder, søkefelt, rename, slett og merge.

**Lag 2 — Tildeling** (aktiveres når bilder er valgt):
Samme liste med tresinnstilstand. Endringer skjer umiddelbart (én tag ad gangen,
ingen «Lagre»-knapp) — én API-kall per toggle.

### Oppretting: advare uten å blokkere

1. Bruker skriver i «Ny tag»-feltet
2. Feltet viser løpende likhetsforslag mens brukeren skriver: «portrett (42 bilder)», «portrettfoto (8 bilder)»
3. Bruker kan velge eksisterende tag fra listen eller fortsette og opprette ny
4. Slug-kollisjon avvises av databasen — UI viser feil med lenke til eksisterende tag

Brukeren blokkeres aldri, men har alltid informasjonen til å ta et bevisst valg.

### Sammenslåing

Primærmekanisme: kontekstmeny på en tag → «Slå sammen med…» → søk etter måltag
→ bekreftelsesdialog som viser «portrett (12 bilder) slås inn i portretter (42 bilder).
54 bilder vil ha taggen portretter.»

Merge-retning vises eksplisitt — kildetag forsvinner, måltag beholder alt.

### Inspect fra utvalg

«Last fra utvalg»-knapp i tildeling-laget: tresinnstilstanden reflekterer
nåværende tags på valgte bilder. Brukeren kan deretter endre valg og applisere
samme tag-sett på et nytt utvalg. Panelet er «låst» til snapshot-tilstanden
fra det opprinnelige utvalget til brukeren velger «Nullstill» eller lukker.

---

## Skillelinje mot Kind og Event

| | Tag | Kind | Event |
|---|---|---|---|
| Formål | Søkeverktøy på tvers | Skilleverktøy innen visning | Organisatorisk gruppe |
| Kardinalitet | Mange per bilde | Én per bilde | Én per bilde |
| Vokabular | Fri form (brukerdefinert) | Kontrollert (admin) | Fri form |
| Hierarki | Nei | Nei | Ja (foreldre/barn) |

---

## Fase 1: Fjerning av gammel modell — Implementert 2026-06-07

Den gamle `ARRAY(String)`-modellen er fjernet i sin helhet:

```
backend/
  alembic/versions/c1d2e3f4a035_remove_tags_array.py  # dropper ix_photos_tags_gin + photos.tags
  # Slettet: api/tags.py, schemas/tag.py
  # Fjernet fra: models/photo.py, schemas/photo.py, api/photos.py,
  #              services/photo_service.py, services/search_service.py,
  #              schemas/saved_search.py, main.py

frontend/src/
  # Slettet: api/tags.ts, pages/TagsPage.tsx,
  #          features/assignment/TagPickerModal.tsx
  # Fjernet fra: types/api.ts, api/photos.ts, stores/useAssignmentStore.ts,
  #              features/assignment/AssignButton.tsx, App.tsx,
  #              components/TopNav.tsx, features/photos/PhotoMetaPanel.tsx,
  #              features/search/searchFields.ts, features/search/SearchValueInput.tsx,
  #              hooks/usePhotoSource.ts, pages/BrowsePage.tsx, api/searches.ts,
  #              features/browse/PhotoTimeline.tsx, features/search/TimelineDayView.tsx
```

## Fase 2: Ny entitetsmodell — Implementert 2026-06-07

```
backend/
  models/tag.py                      # Tag, PhotoTag
  schemas/tag.py                     # TagOut, TagIn, TagMergeResult
  api/tags.py                        # list, create, rename, delete, merge
  services/tag_service.py            # merge-logikk, likhetsøk
  alembic/versions/xxx_tag_entity.py # oppretter tags + photo_tags, pg_trgm-indeks

frontend/src/
  api/tags.ts                        # listTags, createTag, renameTag, deleteTag, mergeTags
  types/api.ts                       # Tag, oppdater PhotoListItem
  features/tags/
    TagsPanel.tsx                    # Kombinert forvaltning + tildeling (≤100 linjer)
    TagList.tsx                      # Virtualisert liste med tresinnstilstand
    TagCreateInput.tsx               # Input med likhetsforslag
    TagMergeDialog.tsx               # Bekreftelsesdialog for merge
  pages/
    TagsPage.tsx                     # Wrapper med AppLayout
```

---

## Konsekvenser

**Gevinst:** Rename, slett og merge er rene enkeltoperasjoner. Likhetsøk ved
oppretting hindrer fragmentering over tid. Tags-fanen gir full oversikt og kontroll.

**Kostnad:** Én join i alle spørringer der tags inngår i filtrering. Migrasjonen
berører `photos`-tabellen og alle relaterte API-endepunkter. Engangsarbeid.
