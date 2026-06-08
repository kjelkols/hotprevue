# ADR-044: Fotograf som identitet og tilgangskontroll

**Status:** Planlagt  
**Dato:** 2026-06-08  
**Erstatter delvis:** ADR-040 (`machines.role`), ADR-042 (forenklet versjon av samme idé)

---

## Kontekst

### Det nåværende problemet

Hotprevue er designet som et énbrukersystem. Fotograftabellen er i dag
ren metadata: et navn som settes på bilder, samlinger og registreringsøkter.
Det finnes ingen kobling mellom «fotograf Anna» i databasen og en autentisert
maskin som Anna bruker.

ADR-040 innførte maskinidentitet (API-tokens) og en `role`-kolonne på
`machines` (`'owner'` / `'guest'`). Dette løste autentisering, men har
to gjenværende svakheter:

**1. Tilgang styres av maskin, ikke av person.**
Rollen sitter på maskinen, ikke på fotografen. Anna kan ha tre maskiner
(iPhone, iPad, laptop) — hver av dem må tildeles riktig rolle separat.
Sletter man en maskin og lager en ny, glemmer systemet hvem personen er.

**2. Enrollering kobler ikke til eksisterende fotograf.**
Når Anna enrolls via invitasjonskode, opprettes alltid en *ny* fotografrad.
Om Anna allerede finnes i databasen (registrert manuelt av eieren med
bilder tilknyttet), oppstår et duplikat. Annas egne bilder er usynlige
for den enrolled maskinen fordi de peker på feil fotograf-UUID.

**3. Ingen tilgangskontroll på lesing.**
Gjestmaskiner er blokkert fra admin-endepunkter via `require_owner`, men
alle `GET /photos`-kall returnerer *alle* bilder uansett hvem som spør.
En gjest ser eiernes fulle bibliotek.

**4. Alle maskiner kan mutere hva som helst.**
Uten `require_owner` på skriveendepunkter kan enhver maskin opprette og
slette fotografer, events, samlinger og bilder. Dette er utilsiktet og
åpner for datakorrupsjon ved feilbruk.

---

## Beslutning

### Fotograf er primær identitet — maskin er inngangspunkt

En fotograf er ikke lenger bare et navn på et bilde. En fotograf *kan*
være en aktiv bruker som kobler seg til Hotprevue via én eller flere
maskiner. Alle maskinene til en fotograf arver fotografens tilgangsnivå.

```
Fotograf «Anna» (access_level='guest')
    ├── Machine: Annas iPhone   (enrolled via invitasjonskode)
    └── Machine: Annas laptop   (enrolled via «legg til maskin»-kode)
```

Fotografer uten tilknyttede maskiner eksisterer fortsatt som rene
metadataentiteter — de har ingen aktiv tilgang og vises ikke som brukere.

### To tilgangsnivåer

```sql
ALTER TABLE photographers ADD COLUMN access_level TEXT NOT NULL DEFAULT 'guest';
```

| Nivå | Hvem | Kan se | Kan gjøre |
|------|------|--------|-----------|
| `owner` | Eier(e) av systemet | Alt | Alt |
| `guest` | Invitert fotograf | Egne bilder | Laste opp, redigere egne bilder |

Det kan finnes flere `owner`-fotografer. Eieren av installasjonen er
alltid `owner`. En `owner` kan gi en annen fotograf `owner`-tilgang.

`machines.role`-kolonnen fra ADR-040 **fjernes** og erstattes av
`photographers.access_level`. Alle maskiner er i praksis nøytrale
inngangspunkter — det er fotografen som bestemmer hva de kan gjøre.

### Hva `guest` kan gjøre

| Operasjon | guest |
|-----------|-------|
| `POST /photos/check-hothashes` | ✓ |
| `POST /input-sessions` (registrer nye bilder) | ✓ |
| `POST /input-sessions/{id}/groups` | ✓ |
| `POST /input-sessions/{id}/complete` | ✓ |
| `GET /photos` (kun egne) | ✓ (filtrert) |
| `GET /photos/{hothash}` (eget bilde) | ✓ |
| `PATCH /photos/{hothash}` (eget bilde) | ✓ |
| `POST /auth/add-machine-code` (legg til egen maskin) | ✓ |
| `GET /photos` (andres bilder) | ✗ |
| `DELETE /photos/…` | ✗ |
| `POST/PATCH/DELETE /events` | ✗ |
| `POST/PATCH/DELETE /collections` | ✗ |
| `POST/PATCH/DELETE /photographers` | ✗ |
| `POST /admin/invite-codes` | ✗ |
| `GET /admin/machines` | ✗ |

### Tre enrolleringsscenarier

#### Scenario A — Ny fotograf (ny person til systemet)

Eier genererer en invitasjonskode med fotografens navn og ønsket
tilgangsnivå. Ny fotografrad opprettes ved enrollering.

```
POST /admin/invite-codes
{
  "photographer_name": "Anna",
  "access_level": "guest",
  "ttl_minutes": 60
}
→ { "code": "ABCD1234" }
```

Enrollering oppretter:
- Ny `Photographer` med `name = "Anna"`, `access_level = "guest"`
- Ny `Machine` koblet til den nye fotografen

#### Scenario B — Koble eksisterende fotograf til maskin

Anna finnes allerede i databasen (med bilder). Eier vil la Anna bruke
sin egen maskin uten å opprette duplikat.

```
POST /admin/invite-codes
{
  "target_photographer_id": "<Annas UUID>",
  "ttl_minutes": 60
}
→ { "code": "EFGH5678" }
```

Enrollering oppretter:
- Ny `Machine` koblet til den *eksisterende* Anna
- Ingen ny fotografrad

`access_level` hentes fra den eksisterende fotografen — eier kan ikke
oppgradere tilgangen via denne kodetypen.

#### Scenario C — Legg til ny maskin (selvbetjening)

Anna har allerede en enrolled iPhone. Hun vil koble til laptoppen uten
å involvere eieren.

```
POST /auth/add-machine-code
Authorization: Bearer hp_<Annas iPhone-token>
→ { "code": "IJKL9012", "expires_at": "…" }   (15 min TTL)
```

Koden er engangsbruk og kortlivet. Enrollering på laptoppen:

```
POST /auth/enroll
{ "code": "IJKL9012", "device_name": "Annas laptop" }
```

Oppretter ny `Machine` koblet til samme fotograf som iPhonen.
Ingen owner-involvering nødvendig.

**Tillitsmodell:** Å ha en gyldig token betyr at man allerede er
godkjent av eieren. Det er rimelig å la en godkjent person koble til
egne ekstraenheter.

### Databaseendringer

#### `photographers`-tabellen

```sql
ALTER TABLE photographers
    ADD COLUMN access_level TEXT NOT NULL DEFAULT 'guest';
```

#### `machine_invite_codes`-tabellen (utvides)

```sql
ALTER TABLE machine_invite_codes
    ADD COLUMN access_level TEXT NULL,
    ADD COLUMN target_photographer_id UUID NULL
        REFERENCES photographers(id);
```

- Scenario A: `access_level` satt, `target_photographer_id` NULL
- Scenario B+C: `target_photographer_id` satt, `access_level` NULL

#### `machines`-tabellen

```sql
ALTER TABLE machines DROP COLUMN role;
```

### Sentralisert tilgangskontroll

#### Dependency: `get_requesting_photographer`

```python
# backend/middleware/machine_auth.py

def get_requesting_photographer(
    machine: Machine | None = Depends(get_machine_from_token),
    db: Session = Depends(get_db),
) -> Photographer | None:
    if machine is None or machine.photographer_id is None:
        return None
    return db.get(Photographer, machine.photographer_id)
```

#### `PhotoAccessFilter`

```python
# backend/services/access_filter.py

class PhotoAccessFilter:
    @staticmethod
    def apply(query, photographer: Photographer | None):
        if photographer is None or photographer.access_level == 'owner':
            return query
        return query.filter(Photo.photographer_id == photographer.id)
```

Brukes i *alle* endepunkter som returnerer bilder:

```python
@router.get("/photos")
def list_photos(
    db: Session = Depends(get_db),
    photographer: Photographer | None = Depends(get_requesting_photographer),
):
    q = db.query(Photo).filter(Photo.deleted_at.is_(None))
    q = PhotoAccessFilter.apply(q, photographer)
    return q.all()
```

#### `require_owner`

Brukes på alle endepunkter som muterer systemtilstand utover egne bilder:

```python
def require_owner(
    photographer: Photographer | None = Depends(get_requesting_photographer),
) -> None:
    if photographer is not None and photographer.access_level != 'owner':
        raise HTTPException(status_code=403, detail="Krever owner-tilgang")
```

Kall uten token (eksisterende eiermaskiner som ikke bruker Bearer-token)
passerer `require_owner` — dette opprettholder bakoverkompatibilitet.

### Endringer i enrolleringslogikken

`POST /auth/enroll` ser på invitasjonskoden og velger flyt:

```python
if invite.target_photographer_id:
    # Scenario B eller C — koble til eksisterende fotograf
    photographer = db.get(Photographer, invite.target_photographer_id)
else:
    # Scenario A — opprett ny fotograf
    photographer = Photographer(
        name=invite.photographer_name or "Gjest",
        access_level=invite.access_level or "guest",
    )
    db.add(photographer)
    db.flush()

machine = Machine(
    machine_name=data.device_name or photographer.name,
    photographer_id=photographer.id,
    # role-kolonnen er fjernet
)
```

### Migrering av eksisterende installasjoner

Alembic-migrasjonen gjør følgende:

1. Legg til `photographers.access_level` med `DEFAULT 'guest'`
2. Finn den maskinen med den tidligste `created_at` som er `role='owner'`
3. Sett `access_level = 'owner'` på fotografen koblet til denne maskinen
4. Legg til `access_level` og `target_photographer_id` på `machine_invite_codes`
5. Fjern `role`-kolonnen fra `machines`

For en typisk énbruker-installasjon (én maskin, én fotograf):
fotografen satt som `owner`, alle andre (om de finnes) beholder `'guest'`.

---

## Hva som ikke endres

- **Attributt-rollen er uendret.** `photos.photographer_id`,
  `collection.photographer_id` og `input_session.default_photographer_id`
  fungerer som før. Fotografer uten maskiner eksisterer fortsatt for
  attribusjonsformål.
- **Registreringspipelinen er uendret.** Alle laster opp via samme flyt.
  `photos.photographer_id` settes fortsatt fra maskinens `photographer_id`.
- **Token-formatet er uendret** (`hp_<32 hex>`). Eksisterende tokens
  fortsetter å fungere.
- **Eiermaskiner uten token** (bruker `X-Machine-ID`-header) fortsetter
  å fungere — `get_requesting_photographer` returnerer `None`, og
  `require_owner` lar dem passere.

---

## Forholdet til PhotographersPage (`/fotografer`)

`/fotografer`-siden viser i dag alle fotografer som metadataliste.
Med dette ADR-et får den en ny seksjon: «Brukere» — fotografer med
`access_level` og tilknyttede maskiner. Fotografer uten maskiner vises
kun i metadatadelen.

Visning av bruker-seksjonen krever en ny respons-type fra backend:

```
GET /photographers?with_machines=true
→ [{ id, name, access_level, machines: [{ machine_id, machine_name, last_seen_at }] }]
```

---

## Forholdet til ADR-040 og ADR-042

- **ADR-040** innførte `machines.role`. Dette ADR-et erstatter den
  kolonnen med `photographers.access_level`. Resten av ADR-040
  (tokens, invite codes, middleware) beholdes og bygges videre på.

- **ADR-042** beskrev en mer ambisiøs flerbrukermodell med
  `member`-tilgangsnivå (se events og collections). Dette ADR-et
  er en forenklet versjon: to nivåer, ingen `member`. `member`-nivået
  kan innføres som en utvidelse av dette ADR-et senere uten brudd.

---

## Begrunnelse

**Tilgangsnivå på fotograf, ikke maskin.**
En persons tillit til systemet er knyttet til personen, ikke enheten.
Å miste en telefon skal ikke kreve at eieren re-evaluerer tilgangen —
personen sperres, ikke maskinen. Maskiner er utskiftbare; identiteten er stabil.

**Selvbetjent maskin-tillegg.**
Å tvinge brukeren til å kontakte eieren for å legge til sin tredje enhet
er unødvendig friksjon. Tilliten er allerede etablert — én godkjent
maskin er nok til å bekrefte identiteten.

**To nivåer i stedet for tre.**
ADR-042 foreslo `owner`/`member`/`guest`. `member` (se andres organiserte
bilder) er nyttig for familiebruk, men kompliserer implementasjonen
merkbart. Det enkle skillet `owner` (alt) / `guest` (egne bilder) dekker
primærbehovet: la en fotograf laste opp og se sine egne bilder.

**`PhotoAccessFilter` som sentralt mønster.**
Tilgangskontroll spredt over 20 endepunkter er en oppskrift på hull.
Én klasse som alltid kalles gjør det mulig å teste, auditere og endre
logikken ett sted.

---

## Implementeringsplan

| Steg | Fil | Innhold |
|------|-----|---------|
| 1 | `backend/alembic/versions/…_photographer_access.py` | `access_level` på `photographers`; `access_level` + `target_photographer_id` på `machine_invite_codes`; fjern `role` fra `machines`; migrasjonslogikk |
| 2 | `backend/models/photographer.py` | `access_level`-kolonne |
| 3 | `backend/models/machine.py` | Fjern `role`; oppdater `MachineInviteCode` med `access_level` og `target_photographer_id` |
| 4 | `backend/services/access_filter.py` | `PhotoAccessFilter.apply()` |
| 5 | `backend/middleware/machine_auth.py` | `get_requesting_photographer`; oppdater `require_owner` til å bruke fotografens `access_level` |
| 6 | `backend/schemas/machine_auth.py` | Oppdater `InviteCodeCreate` med `access_level` og `target_photographer_id`; oppdater `MachineWithRoleOut` |
| 7 | `backend/api/auth.py` | Støtte for scenario B+C i `enroll`; ny `POST /auth/add-machine-code` |
| 8 | `backend/api/admin.py` | Oppdater `InviteCodeCreate`; ny `GET /admin/photographers` |
| 9 | `backend/api/photos.py` | `PhotoAccessFilter` i alle list-endepunkter; `require_owner` på skriveoperasjoner |
| 10 | `backend/api/events.py` | `require_owner` på `POST/PATCH/DELETE` |
| 11 | `backend/api/collections.py` | `require_owner` på `POST/PATCH/DELETE` |
| 12 | `backend/api/photographers.py` | `require_owner` på `POST/PATCH/DELETE` |
| 13 | `frontend/src/api/machineAuth.ts` | Nye API-kall: `createInviteCodeForPhotographer`, `addMachineCode` |
| 14 | `frontend/src/features/settings/UsersPanel.tsx` | Erstatter `GuestMachinesPanel`; viser fotografer med maskiner, inviter, tilbakekall |
| 15 | `backend/tests/api/test_access_control.py` | Owner ser alt, guest ser kun egne, korrekt 403 på skriveoperasjoner |

---

## Avhengigheter

- **ADR-040** — maskinidentitet (tokens, enroll-flyt) er forutsetning og bygges videre på

---

## Konsekvenser

**Gevinst:** En invitert fotograf kan koble sine enheter og se nøyaktig
sine egne bilder. Eier har kontroll over hvem som har tilgang. En person
kan ha mange enheter uten ny eier-involvering etter første gang.
All skriving mot systemdata krever eksplisitt owner-tilgang.

**Kostnad:** `PhotoAccessFilter` må inn i alle list-endepunkter og
`require_owner` i alle skriveendepunkter — systematisk jobb.
`machines.role` forsvinner og bryter mot ADR-040-kode som leste
`machine.role`.

**Risiko:** Eksisterende installasjoner uten token-bruk (eiermaskiner
via `X-Machine-ID`) passerer `require_owner` uten sjekk — dette er
tilsiktet og opprettholder bakoverkompatibilitet, men betyr at
tilgangskontroll kun er aktiv for maskiner som bruker Bearer-token.

**Ikke i scope:**
- `member`-tilgangsnivå (se andres organiserte bilder) — kan legges til senere
- Per-event tilgangsstyring
- Notifikasjoner ved ny aktivitet
- Tokens med automatisk utløp
- Én fotograf kan ikke eie/administrere egne events/collections
