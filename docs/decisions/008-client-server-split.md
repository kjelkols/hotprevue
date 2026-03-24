# 008 — Klient-server-arkitektur: klienten prosesserer filer, backend lagrer

## Status

Godkjent

## Kontekst

De tidligere beslutningene ADR-002 og ADR-003 bygde på forutsetningen om at backend
og originalfiler alltid kjører på samme maskin. Denne forutsetningen la til rette for
en enkel enkeltmaskininstallasjon, men lukket for to viktige bruksscenarier:

1. **Backend på server** — brukeren ønsker å kjøre backend på en dedikert hjemmeserver
   eller NAS, og koble til fra en eller flere klientmaskiner.
2. **Flere klientmaskiner mot samme backend** — samme bildearkiv tilgjengelig fra
   f.eks. bærbar og stasjonær.

ADR-002 valgte bort klient-side filbehandling fordi det opprinnelig var tenkt som
Electron-app, og da distribusjonen ble lagt om til zip+nettleser mistet frontend
filsystemtilgang. Dette stenger for server-scenariet.

## Beslutning

HotPrevue deles i to separate komponenter med klart definerte ansvarsområder:

### Klienten

Et lokalt installert Python-program (zip + uv, samme distribusjonsmåte som i dag)
som serverer React-UI i nettleseren. Klienten eier all bildebehandling:

- Scanner kataloger og finner bildefiler
- Leser originalfiler (RAW, JPEG, TIFF, HEIC, osv.)
- Ekstraherer EXIF-data
- Genererer hotpreview (150×150 px, JPEG, base64)
- Beregner hothash (SHA256 av hotpreview-bytes)
- Genererer coldpreview (maks 1200 px, JPEG)
- Sender ferdig pakke til backend via API

Klienten skriver ingenting til database eller disk — alt går via backend-API.

### Backend

En ren HTTP API-server uten tilgang til klientens filer:

- Tar imot ferdig prosesserte data fra klienten
- Lagrer metadata i PostgreSQL (lokal embedded eller ekstern, se ADR-009)
- Lagrer coldpreview-filer mottatt fra klient til disk
- Serverer coldpreviews via HTTP
- Eksponerer alle søk, oppdateringer og organiseringsfunksjoner

Backend leser aldri originalbilder og vet ikke hvor de befinner seg.

```
Klient (lokalt installert)               Backend (lokal eller på server)
    │                                         │
    │  Leser /bilder/IMG_0042.NEF             │
    │  → EXIF-ekstraksjon                     │
    │  → hotpreview (150×150)                 │
    │  → hothash (SHA256)                     │
    │  → coldpreview (1200px)                 │
    │                                         │
    │  POST /input-sessions/{id}/groups       │
    │  { hothash, hotpreview_b64,             │
    │    coldpreview_b64, exif, ... }         │
    │ ──────────────────────────────────────► │
    │                                         │  Lagre metadata i PostgreSQL
    │                                         │  Lagre coldpreview på disk
    │  200 OK                                 │
    │ ◄────────────────────────────────────── │
```

### Registreringsendepunkter

**`POST /input-sessions/{id}/groups`**

Klienten sender én ferdig prosessert bildegruppe per kall:

```json
{
  "hothash": "ab12cd34ef56...",
  "hotpreview_b64": "<base64-JPEG>",
  "coldpreview_b64": "<base64-JPEG>",
  "master_file": {
    "file_path": "/home/bruker/bilder/IMG_0042.NEF",
    "file_type": "RAW",
    "file_size_bytes": 24187392,
    "file_content_hash": "...",
    "exif_data": { ... }
  },
  "companion_files": [ ... ],
  "taken_at": "2024-06-15T14:23:00",
  "camera_make": "Nikon",
  "camera_model": "Z6 III"
}
```

**`POST /input-sessions/{id}/check-hothashes`**

Klienten sender hothashes for bilder den har prosessert og spør hvilke som allerede
er registrert. Kalles etter hotpreview-generering men *før* coldpreview-generering
for å spare tid på duplikater.

```json
{ "hothashes": ["ab12cd34...", "ef56gh78..."] }
→ { "known": ["ab12cd34..."], "unknown": ["ef56gh78..."] }
```

### System-endepunkter fjernes

`/system/scan-directory`, `/system/browse`, `/system/pick-directory` er klientens
ansvar og fjernes fra backend. Klienten har direkte filsystemtilgang og gjør disse
operasjonene lokalt uten proxy.

## Begrunnelse

- **Muliggjør backend-på-server** uten å måtte ha originalfiler på serveren
- **Muliggjør flermaskinsoppsett** der flere klienter deler ett arkiv
- **Samme teknologistack** — klienten forblir Python + React, ingen Electron eller Tauri
- **Coldpreview er ikke en flaskehals** — maks 1200 px JPEG er håndterbart over LAN
- **Originalfiler overføres aldri** — kun ferdig genererte previews sendes til backend

## Konsekvenser

- `file_path` i databasen refererer til filens plassering på *klientmaskinen*, ikke serveren
- Coldpreview-generering må flyttes fra `backend/utils/` til klient-siden (eller dupliseres)
- EXIF-ekstraksjon og preview-kode som i dag bare finnes i backend, må også finnes i klienten
- Backend-kode for fillesing (`/system`-endepunkter, `groups-by-path`) fases ut
- ADR-002 og ADR-003 er erstattet av denne beslutningen
