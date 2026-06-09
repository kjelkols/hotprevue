# ADR-039: Offentlige lenker for enkeltbilder

**Status:** Implementert  
**Dato:** 2026-06-08  
**Implementert:** 2026-06-09

---

## Kontekst

Dagens «Del»-knapp i `PhotoDownloadShare` bruker `navigator.share()` — en
nettleser-API som bare finnes på mobile enheter og bare deler en fil til
en annen app på telefonen. Den gir ingen permanent lenke, fungerer ikke på
desktop, og er skjult bak en `canShare`-sjekk som gjør den usynlig for de
fleste brukere.

Det som faktisk trengs er en **stabil URL** som kan limes inn i en melding,
legges i et blogginnlegg, eller deles på sosiale medier — og som fungerer
for mottakeren uten at de har tilgang til Hotprevue.

ADR-038 dekker levering av kurerte bildeutvalg til kunder via collections.
Dette er et annet behov: å eksponere ett enkelt bilde raskt og direkte,
uten å opprette en samling.

**Brukstilfeller:**
- «Her er bildet jeg tok av deg» — lenke i en melding
- Fotograf linker til et enkelt bilde fra en bloggpost eller sosiale medier
- Portefølje-referanse: «mitt beste bilde fra 2024»

---

## Beslutning

### Identifikator: hothash som offentlig URL-slug

Hothash er allerede Hotprevues stabile identitet for et bilde — SHA256 av
hotpreview-thumbnailet, 64 hex-tegn. Det er tilstrekkelig ugjettbart for
personlig fotodeling: en angriper som kjenner hothash-formatet må prøve
2²⁵⁶ kombinasjoner for å finne et gyldig bilde. Det opprettes ingen egen
tilfeldig token.

Offentlig URL: `/share/photo/{hothash}`

Dette er konsistent med systemets identitetsmodell — hothash brukes allerede
som ytre nøkkel i batch-API-er, filnavn og URL-er internt.

### Datamodell — minimal utvidelse av Photo

```sql
ALTER TABLE photos ADD COLUMN is_shared       BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE photos ADD COLUMN share_caption   TEXT    NULL;
ALTER TABLE photos ADD COLUMN share_downloads BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE photos ADD COLUMN share_views     INTEGER NOT NULL DEFAULT 0;
```

| Kolonne | Formål |
|---------|--------|
| `is_shared` | Kontrollerer om den offentlige URL-en er aktiv |
| `share_caption` | Valgfri bildetekst som vises på delingssiden (annerledes enn collections-caption) |
| `share_downloads` | Om nedlasting er tillatt fra delingssiden |
| `share_views` | Enkel teller, inkrementeres ved hvert kall til `GET /share/photo/{hothash}` |

Ingen separat tabell — en delt URL er en egenskap ved bildet, ikke en
selvstendig entitet. Tilbakekalling skjer ved å sette `is_shared = false`.

### API

#### Admin (krever ikke autentisering — enkeltbrukersystem)

```
PATCH /photos/{hothash}
      body: { is_shared?, share_caption?, share_downloads? }
```

Deling aktiveres via det eksisterende `PATCH /photos/{hothash}`-endepunktet.
Ingen nye admin-endepunkter.

#### Offentlig

```
GET /share/photo/{hothash}
    → SharedPhotoOut   (200 om is_shared = true)
    → 404             (om is_shared = false eller bildet ikke finnes)
```

`SharedPhotoOut`:

```python
class SharedPhotoOut(BaseModel):
    hothash: str
    coldpreview_url: str
    taken_at: datetime | None
    photographer_name: str | None
    camera_make: str | None
    camera_model: str | None
    share_caption: str | None
    share_downloads: bool
```

EXIF-numeralia (ISO, blender, lukkertid) eksponeres ikke — de avslører
tekniske detaljer fotografen kanskje ikke vil dele. Kamera og dato er
akseptable standardverdier for sosial kontekst.

```
GET /share/photo/{hothash}/download
    → coldpreview JPEG  (om share_downloads = true)
    → 403               (om share_downloads = false)
```

### Open Graph-metadata (server-side rendering)

`GET /share/photo/{hothash}` returnerer JSON til API-klienter og HTML med
OG-tags til nettlesere/crawlere (content negotiation via `Accept`-header,
eller en separat `GET /share/photo/{hothash}/og`-rute for HTML).

```html
<meta property="og:title"       content="[Fotografnavn] — [dato]" />
<meta property="og:image"       content="https://host/data/coldpreviews/ab/cd/…jpg" />
<meta property="og:description" content="[share_caption eller tom]" />
<meta property="og:type"        content="website" />
<meta name="twitter:card"       content="summary_large_image" />
```

Uten OG-tags vil ingen sosiale plattformer vise forhåndsvisning av bildet
— dette er en forutsetning for at deling til sosiale medier skal fungere.

Enkleste implementering: en dedikert HTML-rute i FastAPI som returnerer en
minimal HTML-side med OG-tags og `<meta http-equiv="refresh">` som sender
nettleseren videre til frontend-ruten. Crawlere følger ikke refresh, så de
ser OG-tagene. Nettlesere omdirigeres til `/share/photo/{hothash}` i React.

### Frontend

#### PhotoDetailPage / PhotoDownloadShare

`PhotoDownloadShare`-komponenten erstattes med en ny `PhotoSharePanel`:

```
┌─────────────────────────────────────┐
│  Del dette bildet                    │
│                                     │
│  [✓] Gjør offentlig tilgjengelig    │
│                                     │
│  Lenke:                             │
│  https://host/share/photo/abc…  [Kopi]│
│                                     │
│  Bildetekst (valgfri):              │
│  ________________________________   │
│                                     │
│  [✓] Tillat nedlasting              │
│                                     │
│  Vist 7 ganger                      │
└─────────────────────────────────────┘
```

Lenke-feltet er skrivebeskyttet og vises alltid (også når `is_shared = false`)
slik at fotografen kan kopiere den *før* de skrur den på. Toggle aktiverer
umiddelbart via `PATCH /photos/{hothash}`.

#### Ny rute: `/share/photo/:hothash`

```tsx
// Ingen AppLayout — ren offentlig visning
<SharedPhotoPage />
```

Siden viser:
- Bildet (coldpreview, sentrert, maks 1200px)
- Dato og fotografnavn
- `share_caption` om satt
- «Last ned»-knapp om `share_downloads = true`
- Minimal Hotprevue-signatur nederst («Levert via Hotprevue»)

Siden er stateless — ingen sesjon, ingen cookies, ingen autentisering.

---

## Begrunnelse

**Hothash fremfor tilfeldig token:** For enkeltbilder er det ingen grunn
til å skille mellom «instansen av delingen» og bildet selv. Et bilde er
enten delt eller ikke. Hothash er allerede det stabile uttrykket for
bildets identitet, og 256 bits entropi er tilstrekkelig for personlig
fotodeling uten passord. Om fotografen vil ha passordbeskyttelse, er
riktig verktøy å legge bildet i en collection og bruke ADR-038.

**Ingen separat tokentabell:** Det forenkler implementeringen betydelig og
holder delingslogikken co-lokalisert med bildet. En fremtidig migrasjon
til en tokentabell er ikke vanskeligere å gjøre da enn nå.

**OG-tags er obligatorisk:** Uten dem er lenken ubrukelig på sosiale
medier — plattformene viser bare en rå URL. Halvparten av nytten av å
dele ett bilde er forhåndsvisningen mottakeren ser i meldingen.

**`share_downloads` default true:** En fotograf som deler et bilde ønsker
som regel at mottakeren kan laste det ned. Å gjøre default false ville
kreve en ekstra handling for den vanligste bruken.

---

## Implementering

| Fil | Innhold |
|-----|---------|
| `backend/alembic/versions/a1b2c3d4e039_adr039_photo_sharing.py` | 4 nye kolonner på `photos` |
| `backend/models/photo.py` | `is_shared`, `share_caption`, `share_downloads`, `share_views` |
| `backend/schemas/photo.py` | `SharedPhotoOut`; `PhotoPatch` utvidet; `PhotoDetail` utvidet |
| `backend/api/share.py` | `GET /share/photo/{hothash}`, `/og` (HTML+OG-tags), `/download` |
| `frontend/src/api/photos.ts` | `patchPhoto` utvidet; `getSharedPhoto()` |
| `frontend/src/types/api.ts` | `SharedPhotoOut`; `PhotoDetail` utvidet |
| `frontend/src/features/photos/PhotoSharePanel.tsx` | Erstatter `PhotoDownloadShare` — download + del-panel |
| `frontend/src/pages/SharedPhotoPage.tsx` | Offentlig visningsside (ingen AppLayout) |
| `frontend/src/App.tsx` | Rute `/share/photo/:hothash` uten AppLayout |
| `backend/tests/api/test_share_photo.py` | 10 tester — aktiver/deaktiver, OG-HTML, nedlasting, visnings­teller |

**Avvik fra plan:** `share_views` inkrementeres direkte i API-laget (ikke i `photo_service`). `PhotoDownloadShare` er erstattet av `PhotoSharePanel` som samler nedlasting og deling i én komponent.

---

## Konsekvenser

**Gevinst:** `navigator.share()` fjernes. Alle brukere — desktop og mobil —
får en stabil, kopierbar lenke. Sosiale medier viser bildeforhåndsvisning.
Implementeringen er enkel fordi hothash allerede er den stabile ID-en.

**Kostnad:** Én Alembic-migrasjon (4 nye kolonner). OG-HTML-ruten er den
eneste litt uvanlige biten — to svar for samme URL avhengig av klient.

**Samspill med ADR-038:** Collection-deling og enkeltbilde-deling bruker
den samme `/share/`-router-prefikset og kan dele tjenestekode for
coldpreview-URL-generering og nedlastingsrespons.

**Ikke i scope:**
- Passord på enkeltbilder (bruk collection-share fra ADR-038)
- Kommentarfelt for mottakeren
- Statistikk per mottaker / per geografisk region
- Utløpsdato på enkeltbilde-deling
