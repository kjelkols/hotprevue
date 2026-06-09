# ADR-042: Fotograf som brukeridentitet og flerbruker-tilgangskontroll

**Status:** Erstattet av ADR-044  
**Dato:** 2026-06-08  
**Erstattet:** 2026-06-09 — ADR-044 implementerer en forenklet versjon (to tilgangsnivåer i stedet for tre, ingen `member`-nivå). Dokumentet beholdes for historisk kontekst.

---

## Kontekst

ADR-040 innførte maskinidentitet og invitasjonskoder med to roller:
`owner` og `guest`. Rollene ble lagt på `machines`-tabellen.

Et bredere brukstilfelle er nå identifisert: Hotprevue kan kjøre som et
**delt familiearkiv** der alle familiemedlemmer laster opp bilder fra sine
egne enheter, og familiemedlemmene kan se hverandres organiserte bilder.
Samtidig kan gjestfotografer (som i ADR-041) delta uten å få innsyn i det
delte arkivet.

Dette krever en mer gjennomtenkt tilgangskontroll, og en omstrukturering av
identitetsmodellen: i dag er `Photographer` en metadataentitet (et navn som
settes på bilder). Den må bli en **brukeridentitet** — noen som har tilgang,
eier maskiner og ser et definert utvalg av systemet.

**Brukerscenarier:**
- Familie med felles Hotprevue-server: alle laster opp, alle ser turbildene
- Ven invitert som gjestfotograf: laster opp sine bilder, ser kun egne
- En person med telefon, laptop og stasjonær PC: tre maskiner, én identitet

---

## Beslutning

### Forholdet mellom Fotograf og Maskin snus

**I dag:** `Machine → Photographer` (maskin har én fotograf)  
**Etter:** `Photographer → [Machine, ...]` (fotograf har mange maskiner)

Databasestrukturen endres ikke — `machines.photographer_id` peker fortsatt
på `photographers.id`. Det som endres er at en fotograf nå er den primære
identiteten, og maskiner er inngangspunkter til den identiteten.

```
Photographer «Mum» (access_level='member')
    ├── Machine: Mums iPhone   (registrert via invitasjonskode)
    ├── Machine: Mums iPad     (registrert via «legg til maskin»-kode)
    └── Machine: Mums laptop   (registrert via «legg til maskin»-kode)
```

Alle maskinene arver fotografens tilgangsnivå. Maskin-rollen fra ADR-040
fjernes — det er `Photographer.access_level` som styrer tilgang.

### Tre tilgangsnivåer

```sql
ALTER TABLE photographers ADD COLUMN access_level TEXT NOT NULL DEFAULT 'guest';
```

| Nivå | Hvem | Se bilder | Laste opp | Redigere | Administrere |
|------|------|-----------|-----------|----------|--------------|
| `owner` | Serveroperatøren | Alt | ✓ | Alt | ✓ |
| `member` | Familiemedlem, nær venn | Organiserte bilder* | ✓ | Egne bilder | ✗ |
| `guest` | Gjestfotograf | Egne bilder | ✓ | ✗ | ✗ |

*) Se «Hva `member` ser» under.

Nøyaktig **én** `owner` kan eksistere — enforced på applikasjonsnivå.
Eksisterende installasjoner: den første fotografen i databasen (eller den
fotografen koblet til den første maskinen) settes som `owner` i migrasjonen.

### Hva `member` ser

`member`-tilgang gir **ikke** «se alle bilder». Det gir tilgang til bilder
som er organisert — lagt i et event eller en collection:

```
member kan se:
  ✓ Alle bilder i alle events
  ✓ Alle bilder i alle collections
  ✗ Bilder uten event og uten collection (owners råmateriale)
```

Begrunnelse: Hotprevue er eierens private arkiv. Det inkluderer uferdig
materiale, usorterte råbilder og bilder under gjennomgang. `member`-tilgang
gir innsyn i det *kurerte* innholdet — det eieren har valgt å organisere.
Eieren bestemmer aldri eksplisitt hva som er synlig; det følger naturlig av
organiseringsarbeidet som allerede gjøres.

Dette er også teknisk enklere å filtrere enn «alle bilder minus de private».

### `guest` ser kun egne bilder

```
guest kan se:
  ✓ Bilder der Photo.photographer_id = eget photographer_id
  ✗ Alt annet
```

### `PhotoAccessFilter` — ett sted, brukt overalt

All tilgangskontroll konsentreres i én hjelpeklasse:

```python
# backend/services/access_filter.py

class PhotoAccessFilter:
    @staticmethod
    def apply(query, photographer: Photographer):
        level = photographer.access_level

        if level == 'owner':
            return query  # ingen begrensning

        if level == 'guest':
            return query.filter(
                Photo.photographer_id == photographer.id
            )

        if level == 'member':
            has_event = Photo.event_id.is_not(None)
            in_collection = Photo.id.in_(
                select(CollectionItem.photo_id)
                .where(CollectionItem.photo_id.is_not(None))
                .scalar_subquery()
            )
            return query.filter(or_(has_event, in_collection))
```

Alle endepunkter som returnerer bilder kaller `PhotoAccessFilter.apply()`:

```python
@router.get("/photos")
def list_photos(
    db: Session = Depends(get_db),
    photographer: Photographer = Depends(get_requesting_photographer),
):
    q = db.query(Photo).filter(Photo.deleted_at.is_(None))
    q = PhotoAccessFilter.apply(q, photographer)
    return q.all()
```

`get_requesting_photographer` er en ny FastAPI-dependency som henter
fotografen fra maskin-tokenet (ADR-040) og cacher den i request-konteksten.

### Invitasjonskoder — to scenarier

Eier kan nå invitere på to måter:

**Scenario A — ny person (ny fotograf + ny maskin):**

```
POST /admin/invite-codes
{
  "photographer_name": "Mum",
  "access_level": "member",
  "ttl_minutes": 60
}
→ { code: "ABCD1234" }
```

Enrollment oppretter ny `Photographer` (med `access_level='member'`) og
ny `Machine` koblet til den.

**Scenario B — eksisterende fotograf, ny maskin:**

```
POST /admin/invite-codes
{
  "target_photographer_id": "<uuid>",
  "ttl_minutes": 60
}
→ { code: "EFGH5678" }
```

Enrollment oppretter bare ny `Machine` koblet til den eksisterende
fotografen. Ingen ny fotograf opprettes. Ny maskin arver fotografens
`access_level`.

```sql
ALTER TABLE machine_invite_codes
    ADD COLUMN access_level TEXT NULL,
    ADD COLUMN target_photographer_id UUID NULL
        REFERENCES photographers(id);
```

Enten `access_level` (scenario A) eller `target_photographer_id` (scenario
B) er satt, aldri begge.

### Fotograf-administrasjon i SettingsPage

Ny seksjon «Brukere» i `SettingsPage`:

```
┌──────────────────────────────────────────────┐
│  Brukere                                     │
│                                              │
│  Inviter ny person                           │
│  Navn: ______________                        │
│  Tilgang:                                    │
│    ○ Familiemedlem — ser events og samlinger │
│    ○ Gjest — ser bare egne bilder            │
│  [Generer kode]                              │
│                                              │
│  Registrerte brukere                         │
│  ┌─────────────────────────────────────────┐ │
│  │ 👑 Kjell (eier)                         │ │
│  │    Laptop · iPhone · Beelink            │ │
│  ├─────────────────────────────────────────┤ │
│  │ 👥 Mum  (familiemedlem)                 │ │
│  │    iPhone · iPad    [+ Legg til maskin] │ │
│  │    [Endre til gjest] [Fjern tilgang]    │ │
│  ├─────────────────────────────────────────┤ │
│  │ 👤 Anna  (gjest)   sist sett: i går     │ │
│  │    iPhone           [+ Legg til maskin] │ │
│  │    [Endre til familiemedlem]            │ │
│  └─────────────────────────────────────────┘ │
└──────────────────────────────────────────────┘
```

### Migrering av eksisterende installasjoner

Alembic-migrasjonen:

1. Legg til `photographers.access_level TEXT NOT NULL DEFAULT 'guest'`
2. Sett `access_level = 'owner'` på den fotografen koblet til den eldste
   maskinen (eller den eneste fotografen i en typisk enkeltbruker-installasjon)
3. Sett `access_level = 'member'` på alle øvrige fotografer
   (eksisterende installasjoner antas å ha tillitsforhold mellom fotografene)
4. Fjern `role`-kolonnen fra `machines` (ADR-040 la den dit midlertidig)

### Photographer-UUID må genereres på serveren

ADR-011 advarte om dette, og det gjelder nå enda sterkere: en fotograf
kan ha maskiner på tvers av nettverk. `photographer_id` må alltid
genereres av serveren ved enrollment — aldri av klienten.

---

## Hva som ikke endres

- Registreringspipelinen er uendret — alle laster opp via samme flyt
- `photos.photographer_id` settes fortsatt fra maskinens fotograf
- Collections og events er globale strukturer — `member` ser dem alle
- Kun eier pusher til Imalink
- Kun eier kan slette, endre access-nivå, trekke tilbake tilgang

---

## Forholdet til private rom (ADR-038/043)

Private rom og `member`-tilgang dekker ulike behov og er komplementære:

| | `member`-tilgang | Privat rom |
|---|---|---|
| Krev maskin/node | Ja | Nei |
| Kan laste opp | Ja | Nei |
| Ser fremtidige bilder automatisk | Ja | Nei (statisk lenke) |
| For hvem | Nær familie | Bekjente, kunder, eksterne |
| Levetid | Permanent inntil eier trekker tilbake | Inntil lenken slettes |

`member` er for folk som er en del av arkivets liv over tid.
Privat rom er for folk som får tilgang til ett avgrenset øyeblikk.

---

## Begrunnelse

**`member` ser organiserte bilder, ikke alt:** Eierens ubehandlede
råmateriale er ikke relevant for familiemedlemmer, og å eksponere det
bryter med Hotprevues prinsipp om at eieren har full kontroll. Det kurerte
innholdet (events, collections) er det som er ment å deles internt.

**Tilgangsnivå på Photographer, ikke Machine:** En persons tillit til
systemet henger sammen med personen, ikke enheten. Mum er et
familiemedlem enten hun bruker iPhone eller iPad. Granulering per maskin
ville kreve at eieren tenker på tilgang ved hvert maskin-tillegg, ikke
én gang per person.

**`PhotoAccessFilter` som sentralt mønster:** Tilgangskontroll spredt
over 20 endepunkter er en oppskrift på sikkerhetshull. Én klasse som
alltid kalles gjør det mulig å teste, auditere og endre logikken ett sted.

**Ikke «se alt» for `member`:** Å gi `member` full lesetilgang til alle
bilder ville gjøre Hotprevue til et fullt delt system. Det fjerner eierens
private arbeidsplass. «Organisert» som synlighetsgrense er enkel å
kommunisere og enkel å implementere.

---

## Implementeringsplan

| Steg | Fil | Innhold |
|------|-----|---------|
| 1 | `backend/alembic/versions/…_photographer_access.py` | `access_level` på `photographers`; `access_level` + `target_photographer_id` på `machine_invite_codes`; fjern `role` fra `machines` |
| 2 | `backend/models/photographer.py` | `access_level`, `invited_by` |
| 3 | `backend/services/access_filter.py` | `PhotoAccessFilter.apply()` |
| 4 | `backend/middleware/machine_auth.py` | `get_requesting_photographer` dependency |
| 5 | `backend/api/photos.py` | Legg til `PhotoAccessFilter` i alle list-endepunkter |
| 6 | `backend/api/events.py` | Samme |
| 7 | `backend/api/searches.py` | Samme |
| 8 | `backend/api/collections.py` | Tilgangskontroll (member kan se alle collections) |
| 9 | `backend/api/auth.py` | Utvid enrollment: scenario A og B |
| 10 | `backend/api/admin.py` | Utvid invite-codes med `access_level` og `target_photographer_id`; ny `GET/PATCH /admin/photographers` |
| 11 | `frontend/src/features/settings/UsersPanel.tsx` | Bruker-administrasjon med invitasjon og maskin-oversikt |
| 12 | `backend/tests/api/test_access_control.py` | Owner ser alt, member ser events/collections, guest ser egne |

---

## Avhengigheter

- **ADR-040** (maskinidentitet og invitasjonskode) — dette ADR-et erstatter
  `machines.role` med `photographers.access_level`

---

## Konsekvenser

**Gevinst:** Hotprevue kan brukes som familiearkiv der alle bidrar og alle
ser det felles organiserte innholdet. Gjestfotografer kan delta uten
innsyn. En person kan ha mange enheter uten ny invitasjonskode per enhet.

**Kostnad:** `PhotoAccessFilter` må inn i alle list-endepunkter — en
systematisk, men mekanisk, jobb. Migrasjonen berører `photographers`- og
`machines`-tabellen som er sentrale i hele systemet.

**Risiko:** `member`-synlighet er koblet til event/collection-struktur. Om
eieren aldri legger bilder i events, ser `member` ingenting. Dette er
konsistent med systemets intensjon, men kan overraske nye brukere.

**Ikke i scope:**
- `member` kan opprette egne collections eller events
- Notifikasjoner til `member` om nye bilder
- `member` kan invitere andre
- Per-event tilgangsstyring (gi `guest` tilgang til ett spesifikt event)
- Deling mellom separate Hotprevue-installasjoner
