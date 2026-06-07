# ADR-034: Kind — faglig og administrativ klassifikasjon

**Status:** Implementert  
**Dato:** 2026-06-07  
**Sist oppdatert:** 2026-06-07

---

## Kontekst

To separate klassifikasjonsbehov har fremkommet:

**Administrativt:** Events inneholder bilder av vidt forskjellig opprinnelse —
ekte fotografiske hendelser, screenshot-dumper, WhatsApp-imports og arkivmateriale.
Disse blandes i eventlisten uten mulighet til å skille dem fra hverandre.

**Faglig:** Innenfor et enkelt event (f.eks. en fjelltur) kan bildene vise ulike
motiver: sopp, landskap, portrett, mineraler. Det finnes i dag ingen mekanisme
for å filtrere på innholdstype innenfor en visning.

### Hvorfor ikke bare tags?

Tags er et *søkeverktøy* — fri form, mange per bilde, brukt til å *finne* bilder
på tvers av samlingen. Det manglende verktøyet er et *skilleverktøy*: en sterk,
gjensidig utelukkende klassifikasjon med et lite antall brukerdefinerte kategorier
som lar brukeren *skjære* en visning i distinkte grupper.

Eksempel: på en fjelltur vil brukeren kunne velge «vis bare soppen» eller
«vis alt» — ikke søke frem sopp-bilder fra hele samlingen.

### Hvorfor ikke separate kind-tabeller for event og foto?

Events og bilder deler den samme klassifikasjonsinteressen. En "Sopp"-kind er
meningsfull både som event-type ("dette eventet er primært en soppsanking") og
som bilde-type ("dette bildet viser sopp"). Felles vokabular forenkler
administrasjon og gir konsistens.

---

## Beslutning

Innfør en **`kinds`-tabell** som deles av events og bilder via FK.

- Ett kind per event (`events.kind_id`)
- Ett kind per bilde (`photos.kind_id`)
- Ingen mange-til-mange — kind er en sterk, gjensidig utelukkende klassifikasjon

### Datamodell

```
kinds
─────────────────────────────────────────
id                UUID  PK
name              TEXT  NOT NULL
description       TEXT
color             TEXT  (hex, valgfri)
hidden_by_default BOOL  DEFAULT false
sort_order        INT   DEFAULT 0
is_default        BOOL  DEFAULT false

Constraint: UNIQUE (is_default) WHERE is_default = true
```

```
events.kind_id  → kinds.id  (NOT NULL, FK)
photos.kind_id  → kinds.id  (NOT NULL, FK)
```

### Standard kind

Ett kind med `is_default = true` eksisterer alltid og kan ikke slettes.
Det seedes i migrasjonen med navn "Generelt". Brukeren kan omdøpe det,
men ikke slette det og ikke gjøre det om til ikke-default.

### Sletting

Når et kind slettes:
1. Alle berørte events og bilder nullstilles til standard kind
2. Slett-dialogen viser antall berørte rader: «X events og Y bilder flyttes til Generelt»
3. Standard kind har ingen slett-knapp i admin-UI

### Migrering av eksisterende data

Alembic-migrasjonen:
1. Oppretter `kinds`-tabellen og setter inn standard-raden
2. Legger til `kind_id`-kolonne på `events` og `photos` med standard kind som default
3. Setter NOT NULL-constraint etter at alle rader er fylt

---

## UI

### Filtercheckbokser

Checkbokser for kind vises i:
- **Eventlisten** — filtrerer hvilke events som vises
- **PhotoGrid og PhotoTimeline** — filtrerer hvilke bilder som vises

Standardtilstand: alle kinds avkrysset (vis alt). Tilstand lagres i Zustand
(client-only, localStorage-persistert). Når et nytt kind opprettes er det
automatisk avkrysset — bilder/events med nytt kind skal ikke skjules umiddelbart.

`hidden_by_default` på kinds (f.eks. "Screenshots") påvirker kun *første gangs*
initialisering av filterstate — hvis brukeren aldri har sett filteret før, skjules
det aktuelle kind automatisk.

### Admin-UI

Ny fane **«Kinds»** i settings/admin-seksjonen, plassert ved siden av «Fotografer»-fanen.
Følger samme mønster som fotograf-administrasjon:

- Liste over alle kinds med navn, farge og antall tilknyttede events/bilder
- Legg til nytt kind (navn, beskrivelse, farge, hidden_by_default)
- Rediger eksisterende kind
- Slett kind (med bekreftelsesdialog som viser berørt antall)
- Standard kind vises med distinkt markering — ingen slett-knapp

---

## Skillelinje mot tags

| | Kind | Tag |
|---|---|---|
| Formål | Skilleverktøy | Søkeverktøy |
| Kardinalitet | Én per bilde/event | Mange per bilde |
| Vokabular | Kontrollert (admin-definert) | Fri form |
| UI | Checkboks-filter | Søkefelt |
| Eksempel | "Sopp", "Screenshots" | "kantarell", "regnvær" |

---

## Filer

```
backend/
  models/kind.py
  schemas/kind.py
  api/kinds.py
  services/kind_service.py
  alembic/versions/b2d4e6f8a012_adr034_kind_klassifikasjon.py

frontend/src/
  api/kinds.ts
  types/api.ts                # KindOut lagt til, kind_id på EventNode og PhotoListItem
  stores/useKindFilterStore.ts
  features/kinds/
    KindDialog.tsx
    KindFilterBar.tsx
  pages/KindsPage.tsx
  components/TopNav.tsx       # /kinds lagt til nav
  App.tsx                     # /kinds-rute lagt til
  pages/EventsListPage.tsx    # KindFilterBar integrert
  pages/BrowsePage.tsx        # KindFilterBar integrert
  hooks/usePhotoSource.ts     # kindIds-parameter lagt til
  vite.config.ts              # /kinds lagt til proxy-liste
```
