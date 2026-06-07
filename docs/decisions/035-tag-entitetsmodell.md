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

## Tags-UI — implementert design

### Tag-sett (clipboard-modell)

Tildeling skjer via et globalt **tag-sett** — en samling aktive tags som fungerer
som et clipboard. Settet bevares på tvers av navigasjon (Zustand + localStorage).

**Flyt:**
1. Bruker velger bilder i Browse/Event (checkboxes → SelectionTray vises)
2. Klikk **«⊞ Tag-sett»** i SelectionTray → navigerer til Tags-siden
3. Tags-siden viser alle tags som avkryssingsbokser — huk av for å legge i settet
4. Aktivt sett vises som chips øverst med × for å fjerne enkeltvis
5. Klikk **«Legg til»** eller **«Fjern»** i SelectionTray for å applisere på utvalget
6. Inline feedback: «✓ Kjørvika lagt til 4 bilder» — forsvinner etter 3 sekunder
7. **← Tilbake** fører tilbake til forrige side

SelectionTray er synlig mens brukeren er på Tags-siden, slik at tildeling kan
skje direkte derfra uten å navigere tilbake.

### Tags-siden — dobbelt formål

Siden brukes til både å konfigurere tag-settet og forvalte tags:

- **Avkryssingsboks** per tag = «er i aktivt sett» (ikke direkte tildeling til bilder)
- **Hover-handlinger**: rename (inline), slett, merge
- **«Ny tag»-felt** øverst med debounced likhetsforslag (pg_trgm, > 0.3 likhet)
- Tags-fanen er fjernet fra navigasjonsmenyen — inngangsporten er Tag-sett-knappen

### Sammenslåing

Merge-knapp (hover) → dialog med søkefelt for måltag → bekreftelse viser
«portrett (12 bilder) slås inn i portretter (42 bilder)». Atomisk transaksjon
i backend. Kildetag slettes, måltag beholder alle koblinger.

### Oppretting

Ny tag-feltet viser løpende likhetsforslag mens brukeren skriver.
Slug-kollisjon returnerer 409 — UI viser feilmelding.
Brukeren blokkeres aldri fra å opprette ny tag.

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
  models/tag.py                           # Tag, PhotoTag
  schemas/tag.py                          # TagOut, TagCreate, TagRename, TagSimilar, TagMergeResult
  api/tags.py                             # list, similar, create, rename, delete, merge,
                                          # for-photos, add-to-photos, remove-from-photos
  services/tag_service.py                 # merge-logikk, likhetsøk, hothash-basert batch
  alembic/versions/a1b2c3d4e035_...py    # oppretter tags + photo_tags, pg_trgm-indeks
  tests/api/test_tags.py                  # 21 tester (CRUD, batch, merge, similar)

frontend/src/
  api/tags.ts                        # alle API-kall inkl. tagsForPhotos, add/remove-to-photos
  types/api.ts                       # TagOut, TagSimilar, TagMergeResult
  stores/useTagSetStore.ts           # Zustand + localStorage — aktivt tag-sett (clipboard)
  features/tags/
    TagsPanel.tsx                    # Tags-side: sett-konfigurasjon + forvaltning
    TagList.tsx                      # Liste med avkryssingsbokser (sett-medlemskap) + hover-mgmt
    TagCreateInput.tsx               # Input med debounced likhetsforslag
    TagMergeDialog.tsx               # Bekreftelsesdialog for merge
    TagManagerButton.tsx             # Knapp i SelectionTray → navigerer til /tags
    TagApplyButtons.tsx              # Legg til / Fjern + inline feedback
  pages/TagsPage.tsx                 # Wrapper med AppLayout
```

**Batch-API bruker hothashes** konsistent med resten av API-et (ikke photo-UUIDs).

---

## Konsekvenser

**Gevinst:** Clipboard-modellen skiller «hvilke tags» fra «hvilke bilder» — brukeren
setter opp tag-settet én gang og bruker det på mange utvalg. Rename, slett og merge
er atomiske operasjoner. Likhetsøk hindrer fragmentering over tid.

**Kostnad:** Én join i alle spørringer der tags inngår i filtrering. Migrasjonen
berører `photos`-tabellen og alle relaterte API-endepunkter. Engangsarbeid.
