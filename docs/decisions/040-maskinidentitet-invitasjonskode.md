# ADR-040: Maskinidentitet via invitasjonskode og API-token

**Status:** Implementert  
**Dato:** 2026-06-08

---

## Kontekst

Hotprevue har allerede et maskinsystem (ADR-011): `machines`-tabellen, og
`X-Machine-ID`-headeren som klientene sender med alle kall. Maskinen
identifiseres av en UUID som genereres på klientsiden og sendes som header.

Dette systemet har to svakheter som blir kritiske når gjestnodefunksjonen
(ADR-041) innføres:

**Ingen autentisering.** En hvilken som helst UUID godtas. Det finnes ingen
mekanisme for å verifisere at en maskin faktisk er den den utgir seg for å
være. I praksis er dette greit når alle maskiner tilhører eieren og er
koblet via Tailscale — men en gjesttelefonapp kan ikke stole på det samme.

**Ingen tilgangskontroll per maskin.** Alle maskiner har i dag implisitt
full tilgang til alle endepunkter. Gjestmaskiner skal ha begrenset tilgang
— de skal kunne laste opp, men ikke browse andres bilder, endre metadata
eller administrere systemet.

Løsningen er å innføre **API-tokens** som maskinidentitet og et
**invitasjonskode**-system for enkel registrering av nye maskiner.

Eksisterende eiermaskiner (ADR-032-løsningen, Tailscale-basert) berøres
ikke i denne omgang — de kan migrere til token-modellen i en egen fase.

---

## Beslutning

### Datamodell — tre nye tabeller

#### `machine_tokens`

```
machine_tokens
─────────────────────────────────────────────
id             UUID         PK
machine_id     UUID         FK → machines.machine_id  ON DELETE CASCADE
token_hash     TEXT         NOT NULL  UNIQUE  -- SHA-256 av råtokenet
created_at     TIMESTAMPTZ  NOT NULL  DEFAULT now()
last_used_at   TIMESTAMPTZ  NULL
is_active      BOOLEAN      NOT NULL  DEFAULT TRUE
label          TEXT         NULL              -- «iPhone Kjell», «Annas telefon»
```

Råtokenet lagres aldri i databasen — kun SHA-256-hashen.

#### `machine_invite_codes`

```
machine_invite_codes
─────────────────────────────────────────────
id               UUID         PK
code             TEXT         NOT NULL  UNIQUE  -- 8 tegn, a-z0-9
role             TEXT         NOT NULL  DEFAULT 'guest'
photographer_name TEXT        NULL              -- forhåndsutfylt navn, kan endres
expires_at       TIMESTAMPTZ  NOT NULL          -- 1 time TTL som standard
used_at          TIMESTAMPTZ  NULL
used_by_machine  UUID         NULL  FK → machines.machine_id
created_at       TIMESTAMPTZ  NOT NULL  DEFAULT now()
```

#### Utvidelse av `machines`

```sql
ALTER TABLE machines ADD COLUMN role TEXT NOT NULL DEFAULT 'owner';
ALTER TABLE machines ADD COLUMN enrolled_via_invite UUID
    NULL REFERENCES machine_invite_codes(id);
```

`role` er enten `'owner'` (full tilgang, eksisterende maskiner) eller
`'guest'` (begrenset tilgang, registrert via invitasjonskode).

### Token-format

```
hp_<32 hex-tegn>
```

Eksempel: `hp_a3f92c1d8e4b7605f1a2d3c4e5b6a7f8`. Prefiks `hp_` gjør
tokenet gjenkjennelig i logger og lett å invalidere med regex om det
lekker.

Genereres med `secrets.token_hex(16)`. SHA-256 av råtokenet lagres i
`machine_tokens.token_hash`.

### Innmeldings-API (`/auth/enroll`)

```
POST /auth/enroll
Content-Type: application/json

{
  "code": "ABCD1234",
  "device_name": "Annas iPhone"
}
```

Respons (`201 Created`):

```json
{
  "machine_id": "<uuid>",
  "api_token": "hp_a3f92c1d...",
  "photographer": {
    "id": "<uuid>",
    "name": "Anna"
  }
}
```

**Flyten:**

1. Valider at koden finnes, ikke er brukt og ikke er utløpt → 404/410 om ugyldig
2. Opprett `Photographer` med `photographer_name` fra invitasjonskoden
   (eller standardnavn «Gjest» om ikke satt)
3. Opprett `Machine` med `role = 'guest'`, `machine_name = device_name`
4. Generer råtoken → hash → lagre i `machine_tokens`
5. Merk invitasjonskoden som brukt (`used_at`, `used_by_machine`)
6. Returner `api_token` (kun én gang — kan ikke hentes igjen)

Klientappen lagrer `api_token` i sikker lokal lagring og bruker den
for alle videre kall.

### API-nøkkelautentisering

Alle kall fra gjestmaskiner bruker:

```
Authorization: Bearer hp_a3f92c1d...
```

**Middleware i FastAPI** (`backend/middleware/machine_auth.py`):

```python
def get_machine_from_token(
    authorization: str | None = Header(None),
    db: Session = Depends(get_db),
) -> Machine | None:
    if not authorization or not authorization.startswith("Bearer hp_"):
        return None
    raw_token = authorization.removeprefix("Bearer ")
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    record = db.query(MachineToken).filter_by(token_hash=token_hash, is_active=True).first()
    if record is None:
        raise HTTPException(status_code=401, detail="Ugyldig token")
    record.last_used_at = datetime.now(timezone.utc)
    return record.machine
```

Eksisterende endepunkter (brukt av eiermaskiner via `X-Machine-ID`)
fortsetter å fungere uendret. Token-auth er et nytt lag, ikke en
erstatning — i første omgang.

### Tilgangskontroll per rolle

Gjestmaskiner (`role = 'guest'`) har tilgang til et avgrenset sett
endepunkter:

| Endepunkt | guest | owner |
|-----------|-------|-------|
| `POST /auth/enroll` | ✓ (åpent) | — |
| `POST /photos/check-hothashes` | ✓ | ✓ |
| `POST /input-sessions` | ✓ | ✓ |
| `POST /input-sessions/{id}/groups` | ✓ | ✓ |
| `POST /input-sessions/{id}/complete` | ✓ | ✓ |
| `GET /photos?machine_id=<egen>` | ✓ | ✓ |
| `GET /share/room/{token}` | ✓ | ✓ |
| `GET /photos` (alle bilder) | ✗ | ✓ |
| `DELETE /photos/…` | ✗ | ✓ |
| `POST /collections` | ✗ | ✓ |
| `GET /machines` | ✗ | ✓ |

Tilgangskontroll implementeres som en FastAPI-dependency:

```python
def require_owner(machine: Machine = Depends(get_machine_from_token)):
    if machine and machine.role != 'owner':
        raise HTTPException(status_code=403)
```

### Administrasjon av invitasjonskoder

Eier oppretter koder fra Hotprevue-innstillingssiden:

```
POST /admin/invite-codes
body: { photographer_name?, ttl_minutes? }   -- standard: 60 min
→ { code: "ABCD1234", expires_at }
```

```
GET  /admin/invite-codes    → list[InviteCodeOut]  (aktive + brukte)
DELETE /admin/invite-codes/{id}   → 204  (invalider ubrukt kode)
GET  /admin/machines        → list[MachineOut] med rolle og siste aktivitet
DELETE /admin/machines/{id}/token → 204  (trekk tilbake tilgang)
```

### Invitasjonskode-UI

Enkel seksjon i `SettingsPage` («Maskiner og gjester»):

```
┌─────────────────────────────────────┐
│  Inviter gjestfotograf              │
│                                     │
│  Fotografnavn: ________________     │
│  [Generer kode]                     │
│                                     │
│  Kode: ABCD1234   Utløper: 14:32   │
│  [Kopi] [Del]                       │
│                                     │
│  Registrerte gjestmaskiner          │
│  • Annas iPhone   sist sett: i går  │
│    [Trekk tilbake tilgang]          │
└─────────────────────────────────────┘
```

---

## Begrunnelse

**Token over UUID-header:** UUID-en i `X-Machine-ID` er ikke et hemmelighet
— det er en identifikator. Et API-token er en hemmelighet som faktisk kan
brukes til å autentisere. Gjestmaskiner er utenfor eierens nettverk og
trenger ekte autentisering.

**SHA-256 (ikke bcrypt) for token-hash:** API-tokens er lange og tilfeldige
nok til at langsom hashing ikke gir ekstra sikkerhet utover det SHA-256
allerede gir. Bcrypt er riktig for passord; SHA-256 er riktig for tokens.

**8-tegns invitasjonskode:** Kort nok til å huske eller diktere muntlig.
Med 36 tegn (a-z0-9) og 1 time TTL er brute force upraktisk. Koden er
engangsbruk — brukt eller utløpt kode gir 410 Gone.

**Ikke VPN:** Dette ADR-et gir maskinidentitet og tilgangskontroll over
ordinær HTTPS. En reverse tunnel (ADR-032) gir nettverkstilgang fra
internett. De to løser forskjellige problemer og er uavhengige av
hverandre — men begge trengs for at gjestmaskiner skal fungere fra andre
nettverk enn eierens.

---

## Implementeringsplan

| Steg | Fil | Innhold |
|------|-----|---------|
| 1 | `backend/alembic/versions/…_machine_tokens.py` | `machine_tokens`, `machine_invite_codes`, `role`-kolonne |
| 2 | `backend/models/machine.py` | `MachineToken`, `MachineInviteCode`; `role` på `Machine` |
| 3 | `backend/middleware/machine_auth.py` | Token-lookup, `get_machine_from_token`, `require_owner` |
| 4 | `backend/api/auth.py` | `POST /auth/enroll` |
| 5 | `backend/api/admin.py` | Invite-code og machine-administrasjon |
| 6 | `frontend/src/features/settings/GuestMachinesPanel.tsx` | Inviter + liste registrerte gjester |
| 7 | `backend/tests/api/test_machine_auth.py` | Enroll-flyt, ugyldig kode, utløpt kode, tilgangskontroll |

---

## Konsekvenser

**Gevinst:** Gjestmaskiner kan registreres uten manuell UUID-konfigurasjon.
Tilgangen er begrenset til det gjesten trenger. Tilgang kan trekkes
tilbake umiddelbart (sett `is_active = false`). Eiermaskiners eksisterende
oppførsel endres ikke.

**Kostnad:** Ny middleware, tre nye tabeller, nytt admin-UI. Middels omfang.

**Ikke i scope:**
- Migrering av eiermaskiner til token-modellen (kan gjøres separat)
- Tokens med begrenset levetid (automatisk utløp etter N dager)
- Flere tokens per maskin (rotering)
- OAuth / OIDC
