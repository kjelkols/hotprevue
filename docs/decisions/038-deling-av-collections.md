# ADR-038: Deling av collections via token-lenker

**Status:** Erstattet av ADR-045 (2026-06-09)  
**Dato:** 2026-06-08

> Innholdet er konsolidert inn i [ADR-045: Deling og leveranse](045-deling-og-leveranse.md).
> Del 4 (Collection-lenke) i ADR-045 dekker dette.

---

## Kontekst

En fotograf som leverer bilder til en kunde, deler et utvalg med en
samarbeidspartner, eller publiserer en portefølje trenger å sende en lenke —
ikke et påloggingssystem, ikke et vedlegg, bare en lenke mottakeren kan
åpne i nettleseren.

I dag har Hotprevue en `GET /collections/{id}/export`-rute som laster ned
en ZIP-fil. Det forutsetter at mottakeren har tilgang til systemet. Ingen
delingsmekanisme for eksterne eksisterer.

Collections er allerede det rette primitiivet for leveranse: kuratert,
ordnet, med tekstkort og bildetekster. Deling er den naturlige avslutning
på arbeids­flyten fra registrering → organisering → leveranse.

**Krav:**
- En ekstern mottaker (ikke innlogget bruker) skal kunne åpne en lenke og
  se bildene i samlingen i nettleseren.
- Noen leveranser krever passord; de fleste portefølje-lenker gjør det ikke.
- Lenken kan tilbakekalles (opphevelse må være umiddelbar).
- Fotografen kan ha flere aktive lenker per samling (én til kunden, én til
  nettstedet).
- Nedlasting (ZIP) skal være valgbart per lenke.

**Avgrensning:** Deling av enkeltbilder eller søkeresultater er ikke i scope.
Originalnedlasting (RAW, full JPEG) krever at klientprosessen kjører — ikke
i scope. Coldpreviews (800–1200 px) er tilstrekkelig for leveranse til de
fleste kunder.

---

## Beslutning

### Datamodell

```
collection_shares
─────────────────────────────────────────────
id               UUID          PK
collection_id    UUID          FK → collections.id  ON DELETE CASCADE
token            TEXT          NOT NULL  UNIQUE   -- 32 tilfeldige hex-tegn
label            TEXT          NULL               -- «Til Astrid», «Portefølje»
password_hash    TEXT          NULL               -- bcrypt, NULL = ikke beskyttet
download_enabled BOOLEAN       NOT NULL  DEFAULT TRUE
expires_at       TIMESTAMPTZ   NULL               -- NULL = utløper aldri
created_at       TIMESTAMPTZ   NOT NULL  DEFAULT now()
last_accessed_at TIMESTAMPTZ   NULL
access_count     INTEGER       NOT NULL  DEFAULT 0
```

Token genereres med `secrets.token_hex(16)` (128 bits entropi). Ikke UUID
— token er eksponert i URL og må ikke gi innsyn i autoinkrement eller
tidsstempel.

`access_count` og `last_accessed_at` oppdateres ved hvert kall til
`GET /share/{token}` eller `GET /share/{token}/items`. Brukes til å vise
aktivitet i admin-UI («Åpnet 3 ganger, sist i går»).

### API-endepunkter

#### Admin (krever ikke ekstra autentisering — systemet er enkeltbruker)

```
POST   /collections/{id}/shares
       body: { label?, password?, download_enabled?, expires_at? }
       → CollectionShareOut  (inkl. token)

GET    /collections/{id}/shares
       → list[CollectionShareOut]

DELETE /collections/{id}/shares/{token}
       → 204
```

#### Offentlig (ingen autentisering, tilgangskontroll via token)

```
GET    /share/{token}
       → SharedCollectionOut  (navn, beskrivelse, fotograf, antall bilder,
                               download_enabled, has_password, cover_hotpreview_b64)
       → 404 om token ikke finnes eller er utløpt

POST   /share/{token}/auth
       body: { password: string }
       → 200 { session_token: string }  om riktig
       → 403 om feil

GET    /share/{token}/items
       header: X-Share-Session (om passordbeskyttet)
       → list[SharedItemOut]  (position, caption, coldpreview_url, text_item?)

GET    /share/{token}/download
       header: X-Share-Session (om passordbeskyttet)
       → ZIP  (returnerer 403 om download_enabled = false)
```

#### Passord-session

Passordbeskyttede samlinger krever en sesjonsnøkkel etter autentisering.
Implementeres som et kortvarig, signert JWT eller en enkel `share_sessions`-
tabell med TTL på 24 timer — valgfritt siden dette er enkeltbruker og
risikoprofilen er lav. Enkleste løsning: `POST /share/{token}/auth`
returnerer en `session_token` (UUID lagret i `share_sessions`-tabell med
TTL), som sendes som `X-Share-Session`-header på videre kall.

```
share_sessions
─────────────────────────────────────────────
id              UUID         PK
share_token     TEXT         FK → collection_shares.token
session_token   TEXT         UNIQUE
expires_at      TIMESTAMPTZ
```

Sessions ryddes opp ved oppstart (slette rader eldre enn TTL) — ingen
bakgrunnsprosess nødvendig.

### Hva deles

`SharedItemOut` inneholder:

- `position` — rekkefølge i samlingen
- `coldpreview_url` — URL til coldpreview-filen (`/data/coldpreviews/…`)
- `caption` — bildetekst fra CollectionItem
- `text_item` — tekstkort (tittel + brødtekst), om aktuelt

Fotografens egne notater (`notes`-feltet på CollectionItem) deles ikke.
Fullstendig EXIF-data deles ikke.

### Ruter i frontend

```
/share/:token                 SharedCollectionPage   (ingen AppLayout)
```

`SharedCollectionPage`:
1. Laster `GET /share/{token}` — viser samlingsnavn, beskrivelse, fotograf.
2. Om `has_password = true`: viser passorddialog. `POST /share/{token}/auth`
   → lagrer `session_token` i `sessionStorage` (ikke `localStorage` — gjelder
   bare denne nettleserfanen).
3. Laster `GET /share/{token}/items` — viser bildegalleri.
4. Om `download_enabled`: viser «Last ned alle»-knapp → `GET /share/{token}/download`.

Siden er tilpasset for å vises utenfor Hotprevue sitt eget grensesnitt —
minimal topptekst med samlingsnavn og fotografnavn, ingen navigasjonsmeny,
ingen Hotprevue-branding utover et diskret «Levert via Hotprevue».

### Del-panel i CollectionPage

`CollectionPage` får en **«Del»-knapp** i verktøylinjen. Klikk åpner et
sidepanel (ikke modal — brukeren vil se samlingen bak panelet):

```
┌──────────────────────────────┐
│  Del denne samlingen          │
│                              │
│  Aktive lenker               │
│  ┌────────────────────────┐  │
│  │ 🔗 Til Astrid  [Kopi] [×]│  │
│  │  Åpnet 3×, sist i går  │  │
│  └────────────────────────┘  │
│                              │
│  + Opprett ny lenke          │
│    Etikett: ____________     │
│    Passord:  ____________     │
│    Nedlasting: [✓]           │
│    Utløper:  ____________     │
│    [Opprett]                 │
└──────────────────────────────┘
```

URL som vises: `https://<host>/share/<token>` — ekstern URL basert på
`Origin`-headeren eller en konfigurerbar `HOTPREVUE_PUBLIC_URL`-env-variabel.

---

## Begrunnelse

**Token-basert fremfor slug:** Lesbar slug (`/share/astrid-bryllup-2024`)
er gjettbar og indekseres av søkemotorer. Token med 128 bits entropi
er sikkert selv uten passord. Begge kan implementeres — token er standard
for sensitiv leveranse.

**Ikke OAuth/JWT for passord-sessions:** Systemet er enkeltbruker og
passordet beskytter én samling, ikke en brukerkonto. En `share_sessions`-
tabell med TTL er enkel å forstå og enkel å implementere. JWT ville kreve
hemmelig nøkkel og rotasjonslogikk for minimal ekstra gevinst.

**Kun coldpreviews i delt visning:** Originalfiler kan ligge på en lokal
harddisk på klientmaskinen — serveren har aldri tilgang. Coldpreviews
(800–1200 px) er tilstrekkelig for kundegodkjenning og nettvisning. For
originalleveranse er ZIP av coldpreviews et mellomtrinn; en fremtidig ADR
kan adressere klientassistert original-eksport.

**`download_enabled` per lenke:** Fotografen kan eksponere samme samling
som portefølje (uten nedlasting) og som kundelevering (med nedlasting) via
to separate lenker, uten å duplisere samlingen.

**`access_count` og `last_accessed_at`:** Gir fotografen svar på «har
kunden sett bildene?» uten å implementere et varslingssystem.

---

## Implementeringsplan

| Steg | Fil | Innhold |
|------|-----|---------|
| 1 | `backend/models/collection.py` | `CollectionShare`, `ShareSession` |
| 2 | `backend/alembic/versions/…_collection_shares.py` | Migrasjon: to nye tabeller, unik indeks på token |
| 3 | `backend/schemas/collection_share.py` | `CollectionShareOut`, `CollectionShareCreate`, `SharedCollectionOut`, `SharedItemOut` |
| 4 | `backend/services/share_service.py` | `create_share`, `list_shares`, `delete_share`, `get_shared`, `verify_password`, `get_shared_items` |
| 5 | `backend/api/collection_shares.py` | Admin-endepunkter (montert under `/collections`) |
| 6 | `backend/api/share.py` | Offentlige endepunkter (`/share/{token}`) |
| 7 | `frontend/src/api/shares.ts` | API-kall (admin + offentlig) |
| 8 | `frontend/src/types/api.ts` | `CollectionShareOut`, `SharedCollectionOut`, `SharedItemOut` |
| 9 | `frontend/src/features/collection/CollectionSharePanel.tsx` | Del-panel med aktive lenker og oppretting |
| 10 | `frontend/src/pages/SharedCollectionPage.tsx` | Offentlig visningsside |
| 11 | `frontend/src/App.tsx` | Ny rute `/share/:token` uten AppLayout |
| 12 | `backend/tests/api/test_shares.py` | Opprett, hent, passord-auth, slett, utløpt token |

---

## Konsekvenser

**Gevinst:** Lukker det viktigste gapet mellom Hotprevue og konkurrentene
for profesjonell bruk. Fotografen kan levere et ferdig bildevalg til en
kunde uten at kunden trenger tilgang til selve systemet.

**Kostnad:** To nye tabeller, én ny tjeneste, én ny offentlig rute-gruppe,
én ny side. Omfanget er avgrenset — ingenting i eksisterende collections-
kode berøres.

**Ikke i scope:**
- Originalnedlasting (krever klientassistanse)
- Kommentarer eller bildevalg fra mottaker («kundegodkjenning»)
- E-postvarsling om ny aktivitet
- Deling av enkeltbilder eller søkeresultater
- Tidsbegrenset visning (kun nedlasting er tidsbegrenset via `expires_at`)
