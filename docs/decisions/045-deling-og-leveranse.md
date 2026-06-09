# ADR-045: Deling og leveranse

**Status:** Implementert (Del 1–3 og 5). Del 4 (Collection-lenke) planlagt.
**Dato:** 2026-06-09  
**Oppdatert:** 2026-06-09 (Del 5: offentlig relay implementert og testet lokalt)
**Erstatter:** ADR-030, ADR-038, ADR-039

---

## Kontekst

Fotografen trenger å ta bilder ut av Hotprevue på fire måter:

| Modus | Hvem | Formål | Status |
|-------|------|--------|--------|
| **Nedlasting** | Eier | JPEG med EXIF til lokal disk | ✅ Implementert |
| **Native deling** | Eier | OS-delingsark for mobil/desktop | ✅ Implementert |
| **Offentlig bildelenke (Tailscale)** | Nettverksbrukere | Ett bilde via lenke med OG-tags | ✅ Implementert |
| **Offentlig bildelenke (relay)** | Alle på internett | Stabil offentlig URL via ekstern server | ✅ Implementert |
| **Collection-lenke** | Ekstern | Kuratert bildeutvalg til kunde/partner | Planlagt |

Backend leser aldri originalfiler — alt leveres som coldpreviews (800–1200px JPEG).

---

## Del 1: Nedlasting

### Beslutning

```
GET /photos/{hothash}/download?size=full|medium|small
```

| `size` | Maks dimensjon | Brukstilfelle |
|--------|----------------|---------------|
| `full` (standard) | ingen (som coldpreview) | arkiv, print |
| `medium` | 1200px | web, e-post |
| `small` | 600px | meldingsapper |

Svaret er en JPEG med `Content-Disposition: attachment` og `Cache-Control: no-store`.

### EXIF-innhold

Nedlastet JPEG inneholder:

**Fra Photo/ImageFile:**
- `DateTimeOriginal` — lokal kameratid (`taken_at` konvertert med `taken_at_utc_offset`). Hoppes over for accuracy `year`/`decade`/`unknown` (for upresist).
- `OffsetTimeOriginal` — UTC-offset som `"+02:00"` når `taken_at_utc_offset` er satt.
- `Make`, `Model`, `LensModel`
- `ISOSpeedRatings`, `FNumber`, `ExposureTime`, `FocalLength`
- GPS `LatitudeRef`/`Latitude`/`LongitudeRef`/`Longitude` om de finnes
- `GPSHPositioningError` — nøyaktighet i meter når `location_accuracy_meters` er satt

**Fra Hotprevue:**
- `Artist`, `Copyright` — fotografens navn
- `Software` — `"Hotprevue"`
- `ImageDescription` — `"hothash:{hothash}"` (sporbart, maskinlesbart)
- `UserComment` — provenance-streng, pipe-separert:
  ```
  Hotprevue
  Hotprevue|corrections:rotation=90,exposure_ev=+0.5
  Hotprevue|time_source:Kamera-offset justert|time_accuracy:month|location_source:Manuelt plassert
  ```

**Viktige presiseringer:**
- `taken_at` er alltid UTC i databasen. `DateTimeOriginal` skal være lokal tid → offset legges til.
- Uten `taken_at_utc_offset` skrives UTC direkte (samme feil som original EXIF uten offset-info).
- `UserComment` dokumenterer ikke-opprinnelige tidskilder (`offset_corrected`, `manual`, `estimated`) og posisjonskilder (`manual`, `estimated`, `batch_assigned`) slik at mottakeren vet at data er modifisert.

`piexif` brukes til å bygge og skrive EXIF-blokken. `serve_coldpreview()` bruker
samme pipeline — høyreklikk → Lagre bilde i nettleseren gir korrekte metadata.

### Filnavn

```
{hothash}.jpg
```

### Frontend

`PhotoSharePanel` (erstatter `PhotoDownloadShare`): dropdown med tre størrelser
i verktøylinjen på `PhotoDetailPage`. Kontekstmeny i `PhotoGrid`: «Last ned (full)»
via `window.open()`.

---

## Del 2: Native deling (Web Share API)

### Beslutning

`navigator.share({ files: [file] })` støttes i:
- iOS Safari 15+, Android Chrome, macOS Safari, Windows Edge (delvis)

Frontend sjekker `navigator.canShare?.({ files })` og viser Del-knappen bare
når støttet. `size=medium` brukes som standard (god balanse mellom kvalitet og
filstørrelse for deling). Faller stille tilbake til ren nedlasting.

**Avvist:**
- Dedikert Gmail/WhatsApp-knapp — plattformspesifikt, `mailto:` støtter ikke vedlegg
- QR-kode — unødvendig der Web Share API dekker behovet
- «Kopier bildelenke» — nyttig bare om backend er offentlig tilgjengelig

---

## Del 3: Offentlig bildelenke

### Formål

Fotografen deler ett enkelt bilde som en stabil URL — i en melding,
bloggpost eller på sosiale medier. Mottakeren trenger ingen tilgang til
Hotprevue.

### Datamodell

Fire kolonner på `photos`-tabellen:

```sql
is_shared       BOOLEAN  NOT NULL  DEFAULT FALSE
share_caption   TEXT     NULL
share_downloads BOOLEAN  NOT NULL  DEFAULT TRUE
share_views     INTEGER  NOT NULL  DEFAULT 0
```

Ingen separat tabell — deling er en egenskap ved bildet. Hothash er
identiteten (256 bits entropi — tilstrekkelig uten ekstra token).

### API

```
GET /share/photo/{hothash}
    → SharedPhotoOut  (JSON, inkrementerer share_views)
    → 404 om is_shared = false

GET /share/photo/{hothash}/og
    → HTML med OG-tags + meta-refresh til /#/share/photo/{hothash}
    → Crawlere (sosiale medier) ser OG-tags; nettlesere videresendes

GET /share/photo/{hothash}/download
    → JPEG  (krever share_downloads = true, ellers 403)
```

`SharedPhotoOut` inneholder: `hothash`, `coldpreview_url`, `taken_at`,
`photographer_name`, `camera_make`, `camera_model`, `share_caption`, `share_downloads`.

EXIF-numeralia (ISO, blender, lukkertid) deles ikke — avslører detaljer
fotografen kanskje ikke ønsker offentlig.

Aktivering via eksisterende `PATCH /photos/{hothash}`:
```json
{ "is_shared": true, "share_caption": "Tekst", "share_downloads": true }
```

### OG-tags

```html
<meta property="og:title"       content="{fotografnavn} — {dato}" />
<meta property="og:image"       content="{base_url}/photos/{hothash}/coldpreview" />
<meta property="og:description" content="{share_caption}" />
<meta property="og:type"        content="website" />
<meta name="twitter:card"       content="summary_large_image" />
<meta http-equiv="refresh"      content="0;url=/#/share/photo/{hothash}" />
```

Crawlere følger ikke `meta-refresh` — de ser OG-tags og genererer
forhåndsvisning. Nettlesere omdirigeres til React-siden.

### Frontend

`PhotoSharePanel` i `PhotoDetailPage`:
- "Del"-knapp (blå når aktiv)
- Panel med toggle, kopierbar `/og`-URL, bildetekstfelt, nedlastingstoggle, visningsantall
- `SharedPhotoPage` (`/share/photo/:hothash`) — offentlig visning uten AppLayout

### Migrasjon

`a1b2c3d4e039_adr039_photo_sharing.py`

---

---

## Del 5: Offentlig bildedeling via relay

### Motivasjon

Tailscale-lenken (Del 3) er kun tilgjengelig for brukere på samme Tailnet. For å
dele et bilde med hvem som helst på internett trengs en ekstern server som kan
ta imot og videreformidle bildefilen.

### Arkitektur B: push-relay

```
Hotprevue backend                Relay (Trollfjell)              Internett
──────────────────               ──────────────────              ──────────
POST /share/photo/{hh}/public
  → public_share_service.py
      les coldpreview fra disk
      generer token (32 hex)    POST /push/{token}?ttl=N
      ────────────────────────► lagre fil på disk
      lagre token + utløp i db  (nginx server filen)
      ◄────────────────────────
  → public_url + expires_at                           ──────────► {base_url}/{token}.jpg

DELETE /share/photo/{hh}/public  DELETE /push/{token}
  ────────────────────────────►  slett fil fra disk
  nullstill token i db
```

**Valg av arkitektur:** Tre alternativer ble vurdert:
- A: Reverse proxy (nginx tunnel) — krever åpen port inn til Tailnet, kompleks nettverkskonfigurasjon.
- **B: Push-relay (valgt)** — Hotprevue pusher aktivt til ekstern server. Enkel, robust, umiddelbar tilbakekalling.
- C: CDN/objektlager (S3-kompatibelt) — mer kompleksitet enn nødvendig for enkeltfiler.

Arkitektur B velges fordi den er enkel å forstå, ikke krever endringer i
nettverkstopologien, og gir umiddelbar tilbakekalling (DELETE sletter filen).

### Datamodell

To nye kolonner på `photos`:

```sql
public_share_token    TEXT     NULL  UNIQUE  -- 32 hex-tegn, generert ved publisering
public_share_expires_at TIMESTAMPTZ NULL    -- utløpstidspunkt basert på TTL-innstilling
```

Fire nye kolonner på `system_settings`:

```sql
public_share_relay_url       TEXT     NULL  -- API-base til relay, f.eks. https://relay.trollfjell.no
public_share_base_url        TEXT     NULL  -- Offentlig base-URL, f.eks. https://del.trollfjell.no
public_share_api_key         TEXT     NULL  -- Felles hemmelighet (X-API-Key)
public_share_default_ttl_days INTEGER NOT NULL DEFAULT 30
```

### API

```
POST /share/photo/{hothash}/public
    → PublicShareOut { public_url, expires_at }
    → 422 om relay ikke er konfigurert
    → 502 om relay-server ikke svarer

DELETE /share/photo/{hothash}/public
    → 204  (best-effort — sletter lokal tilstand uansett)
```

`PhotoDetail`-responsen inkluderer `public_share_token` og `public_share_expires_at`
slik at frontend kan vise status uten ekstra kall.

### Relay-applikasjon

`relay/relay.py` — ~100 linjer FastAPI:

| Endepunkt | Metode | Effekt |
|-----------|--------|--------|
| `/push/{token}` | POST | Lagrer JPEG til `/var/www/share/{token}.jpg` + metadata |
| `/push/{token}` | DELETE | Sletter fil + metadata umiddelbart |
| `/health` | GET | `{ status, active }` |

Metadata lagres i `/var/www/share/.meta.json` (token → expiry-timestamp).
Cleanup kjører ved oppstart og hver time (bakgrunnstråd) — sletter utløpte filer.

Nginx server `/var/www/share/` som statiske filer direkte. Alle PUT/POST/DELETE
proxies til relay på port 8010.

### Frontend

`PhotoPublicShare` (`features/photos/PhotoPublicShare.tsx`):
- Vises inni "Del"-panelet i `PhotoSharePanel`
- Viser konfigurasjonsmelding med lenke til innstillinger om relay ikke er satt opp
- "Publiser offentlig"-knapp → `POST /share/photo/{hh}/public`
- Viser stabil URL + kopierknapp + utløpsdato
- "Trekk tilbake lenke"-knapp → `DELETE /share/photo/{hh}/public`

`PublicShareSettings` (`features/settings/PublicShareSettings.tsx`):
- Ny "Deling"-fane i Innstillinger
- Felt: Relay-URL, base-URL, API-nøkkel, TTL

### Migrasjon

`b2c3d4e5f045_public_share.py`

### Installasjon av relay på Trollfjell

Se `relay/README.md`.

---

## Del 4: Collection-lenke (planlagt)

### Formål

Levere et kuratert bildeutvalg til en kunde eller samarbeidspartner via en
lenke — uten at mottakeren trenger tilgang til Hotprevue. Collections er
allerede det rette primitiiivet: kuratert, ordnet, med tekstkort og bildetekster.

### Datamodell

```sql
collection_shares
──────────────────────────────────────────────
id               UUID         PK
collection_id    UUID         FK → collections.id  ON DELETE CASCADE
token            TEXT         NOT NULL  UNIQUE   -- secrets.token_hex(16)
label            TEXT         NULL               -- «Til Astrid», «Portefølje»
password_hash    TEXT         NULL               -- bcrypt, NULL = ikke beskyttet
download_enabled BOOLEAN      NOT NULL  DEFAULT TRUE
expires_at       TIMESTAMPTZ  NULL               -- NULL = utløper aldri
created_at       TIMESTAMPTZ  NOT NULL  DEFAULT now()
last_accessed_at TIMESTAMPTZ  NULL
access_count     INTEGER      NOT NULL  DEFAULT 0

share_sessions
──────────────────────────────────────────────
id              UUID        PK
share_token     TEXT        FK → collection_shares.token
session_token   TEXT        UNIQUE
expires_at      TIMESTAMPTZ
```

Token er 128 bits entropi — ikke UUID (gjettbar) og ikke hothash (ett bilde
kan ha mange aktive lenker, én samling kan ha mange). `access_count` og
`last_accessed_at` brukes for å gi fotografen svar på «har kunden sett bildene?».

### API

**Admin (krever owner-tilgang):**
```
POST   /collections/{id}/shares
       body: { label?, password?, download_enabled?, expires_at? }
       → CollectionShareOut  (inkl. token)

GET    /collections/{id}/shares
       → list[CollectionShareOut]

DELETE /collections/{id}/shares/{token}
       → 204
```

**Offentlig (autentisering via token):**
```
GET    /share/{token}
       → SharedCollectionOut  (navn, beskrivelse, fotograf, antall, has_password)
       → 404 om token ikke finnes eller er utløpt

POST   /share/{token}/auth
       body: { password: string }
       → 200 { session_token: string }
       → 403 om feil passord

GET    /share/{token}/items
       header: X-Share-Session (om passordbeskyttet)
       → list[SharedItemOut]  (position, caption, coldpreview_url, text_item?)

GET    /share/{token}/download
       header: X-Share-Session (om passordbeskyttet)
       → ZIP  (403 om download_enabled = false)
```

`SharedItemOut`: `position`, `coldpreview_url`, `caption`, `text_item`.
Fotografens `notes` deles ikke. Full EXIF deles ikke.

### Frontend

**Del-panel i CollectionPage** (sidepanel, ikke modal):
```
┌──────────────────────────────┐
│  Del denne samlingen          │
│  Aktive lenker               │
│  ┌────────────────────────┐  │
│  │ 🔗 Til Astrid  [Kopi] [×]│ │
│  │  Åpnet 3×, sist i går  │  │
│  └────────────────────────┘  │
│  + Opprett ny lenke          │
│    Etikett: ____________     │
│    Passord:  ____________    │
│    Nedlasting: [✓]           │
│    Utløper:  ____________    │
│    [Opprett]                 │
└──────────────────────────────┘
```

URL som vises: `{origin}/share/{token}` (absolutt URL basert på `window.location.origin`).

**`SharedCollectionPage`** (`/share/:token`, ingen AppLayout):
1. Laster `GET /share/{token}` — viser samlingsnavn og fotograf
2. Om `has_password = true`: viser passorddialog
3. Laster `GET /share/{token}/items` — gallerilistning
4. Om `download_enabled`: «Last ned alle»-knapp

Minimal topptekst, ingen navigasjonsmeny, «Levert via Hotprevue» i bunnen.

### Implementeringsplan

| Steg | Fil | Innhold |
|------|-----|---------|
| 1 | `backend/models/collection.py` | `CollectionShare`, `ShareSession` |
| 2 | `backend/alembic/versions/…_collection_shares.py` | Migrasjon |
| 3 | `backend/schemas/collection_share.py` | `CollectionShareOut`, `SharedCollectionOut`, `SharedItemOut` |
| 4 | `backend/services/share_service.py` | CRUD + passord-verifisering |
| 5 | `backend/api/collection_shares.py` | Admin-endepunkter under `/collections` |
| 6 | `backend/api/share.py` | Offentlige endepunkter (utvid eksisterende router) |
| 7 | `frontend/src/api/shares.ts` | API-kall |
| 8 | `frontend/src/types/api.ts` | `CollectionShareOut`, `SharedCollectionOut`, `SharedItemOut` |
| 9 | `frontend/src/features/collection/CollectionSharePanel.tsx` | Del-panel |
| 10 | `frontend/src/pages/SharedCollectionPage.tsx` | Offentlig visningsside |
| 11 | `frontend/src/App.tsx` | Rute `/share/:token` uten AppLayout |
| 12 | `backend/tests/api/test_collection_shares.py` | Opprett, hent, passord-auth, slett, utløpt |

---

## Felles betraktninger

**Token vs. hothash som identifikator:**
- Collection-lenker bruker separat token fordi samme samling kan ha mange lenker.
- Enkeltbilder bruker hothash fordi deling er en egenskap ved bildet selv.

**OG-tags kun for enkeltbilder:**
Collection-visningen er interaktiv (scrolling, passord, nedlasting) og egner
seg ikke for OG-forhåndsvisning på sosiale medier.

**`download_enabled` per lenke (collections):**
Fotografen kan eksponere samme samling som portefølje (uten nedlasting) og
som kundelevering (med nedlasting) via to separate lenker.

**Backend leser aldri originalfiler:**
Alle leveransekanaler bruker coldpreviews. Originalnedlasting krever
klientassistanse og er ikke i scope.

---

## Konsekvenser

- `piexif>=1.1` er backend-avhengighet for EXIF-skriving
- `/share/`-prefix er forbeholdt offentlige, uautentiserte endepunkter
- Collection-deling krever to nye tabeller og `bcrypt`-avhengighet for passord
- Alle JPEG-er som forlater systemet inneholder EXIF-proveniensdata
