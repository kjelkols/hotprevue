# ADR-041: Gjestnode — telefon som registreringsklient (PWA)

**Status:** Planlagt  
**Dato:** 2026-06-08

---

## Kontekst

ADR-040 gir maskiner kryptografisk identitet og definerer gjestmaskiner
med begrenset tilgang. Denne ADR-en spesifiserer hva gjestmaskinen
faktisk er og gjør: en **telefon** som kan laste opp bilder direkte til
Hotprevue, kredittert den gjestfotografen som eier telefonen.

**Brukstilfellet:** To venner er på fjelltur. Den ene (eieren) har
Hotprevue. Den andre tar bilder med sin telefon og vil at bildene havner
i det samme arkivet, tagget med sitt eget navn. Etter turen kan eieren
kuratere bildematerialet fra begge og publisere en collection.

**Kravene:**
- Gjestfotografen installerer ikke noe — åpner bare en nettside
- Opplasting fra kamerarulle eller direkte kameraopptak
- Originalfiler forblir på telefonen
- Bilder krediteres gjestfotografens navn automatisk
- Ingen tilgang til andres bilder
- Eier kan se og kuratere gjestbilder i Hotprevue

---

## Beslutning

### PWA — ikke native app

Gjestappen er en **Progressive Web App** — en nettside som oppfører seg
som en app. Gjestfotografen åpner en URL (mottatt fra eieren), bruker
invitasjonskoden (ADR-040), og er klar til å laste opp.

Fordeler over native app:
- Ingen App Store, ingen installasjon
- Fungerer på iOS og Android
- Kan deles som en URL
- Vedlikeholdes som en del av Hotprevue-distribusjonen

Begrensninger:
- Kamerarulle-tilgang er noe begrenset på iOS (velger enkeltbilder, ikke
  direkte mappelesing) — tilstrekkelig for brukstilfellet
- Ingen bakgrunnsopplasting etter at appen lukkes

PWA-en er en **separat liten frontend-applikasjon** i `pwa/`-mappen,
bygget med React + Vite. Den er ikke en del av Hotprevues hoved-UI (som
er en full desktop-orientert applikasjon). Serveres av Hotprevue-backend
på `/pwa/`.

### Bildebehandling i nettleseren

All behandling skjer i nettleseren — originalfilen forlater aldri enheten.

#### Hotpreview og hothash (browser-side)

```
1. Bruker velger bilde fra kamerarulle
2. Dekod EXIF-orientering (exifr-biblioteket, ~50 kB gzipped)
3. Tegn bildet på et 150×150 Canvas med korrekt orientering (rotasjon fra EXIF)
4. canvas.toBlob() → JPEG → base64  →  hotpreview_b64
5. SHA-256 av hotpreview-bytes via SubtleCrypto API  →  hothash
```

#### Coldpreview (browser-side)

```
1. Tegn originalbildet på et Canvas, skalert til maks 1200px (lang side)
2. canvas.toBlob({ type: 'image/jpeg', quality: 0.88 })  →  coldpreview_b64
```

Mobilkamera produserer typisk 4000–8000px JPEG. Resizing til 1200px i
Canvas gir god kvalitet uten tap av detaljer som er synlige på skjerm.

#### EXIF-lesing (browser-side)

`exifr`-biblioteket leser EXIF direkte fra `File`-objektet i nettleseren:
dato, GPS, kameramodell, ISO, aperture, focal length. Samme feltsett som
backend-sidert `exif.py`-modul — resultatet pakkes i samme JSON-struktur
og sendes som del av gruppe-payloaden.

### Opplastingspipeline

Identisk med desktop-klientens flyt (ADR-024), kjørt fra nettleseren:

```
1. POST /photos/check-hothashes  { hothashes: [...] }
   → { known: [...], unknown: [...] }

2. POST /input-sessions
   → { id: session_id }

3. For hvert ukjent bilde:
   POST /input-sessions/{id}/groups
   {
     hothash,
     hotpreview_b64,
     coldpreview_b64,
     exif_data,
     file_name,
     machine_id  ← fra ADR-040-token
   }

4. POST /input-sessions/{id}/complete
```

Autentisering via `Authorization: Bearer hp_...` (ADR-040).

Backend setter automatisk `photographer_id` fra maskinens tilknyttede
fotograf — gjestfotografens navn følger med alle bildene.

### Opplastingsflyt i PWA-en

```
┌─────────────────────────────────────┐
│  📷 Hotprevue                       │
│                                     │
│  Hei, Anna                          │
│  17 bilder klare til opplasting     │
│                                     │
│  [+ Velg flere bilder]              │
│                                     │
│  ──────────────────────────────     │
│  ✓ IMG_4201.jpg                     │
│  ✓ IMG_4202.jpg   allerede lastet   │
│  ↑ IMG_4203.jpg   laster opp… 60%  │
│  · IMG_4204.jpg                     │
│                                     │
│  [Last opp alle]                    │
└─────────────────────────────────────┘
```

**Tilstandshåndtering:**
- Hothash beregnes lokalt → duplikater filtreres ut før opplasting vises
- «Allerede lastet» vises umiddelbart for kjente hothashes
- Opplasting skjer ett og ett bilde (ikke parallel batch) for å spare
  mobil datapakke
- Fremdrift vises per bilde
- Appen husker sesjonstokenet i `localStorage` — neste gang går brukeren
  rett til opplastingsskjermen

### Enrollment-skjerm (første gang)

```
┌─────────────────────────────────────┐
│  Koble til Hotprevue                │
│                                     │
│  Invitasjonskode:                   │
│  [  A  B  C  D  1  2  3  4  ]      │
│                                     │
│  Enhetsnavn (valgfritt):            │
│  [Annas iPhone           ]          │
│                                     │
│  [Koble til]                        │
└─────────────────────────────────────┘
```

Etter vellykket enrollment vises opplastingsskjermen direkte. Koden
trengs aldri igjen — tokenet er lagret.

### Gjestefeed i Hotprevue

Eieren trenger et sted å se og kuratere gjestbilder uten at de blandes
inn i hoved-Browse-visningen.

**Ny fane/seksjon: «Gjestebilder»** — tilgjengelig fra TopNav:

```
┌─────────────────────────────────────────┐
│  Gjestebilder                    [Kuratert: 12] │
│                                               │
│  Anna  •  23 bilder  •  sist: i dag           │
│  [Vis alle] [Vis bare nye]                    │
│  ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                    │
│  │  │ │  │ │  │ │  │ │  │  …                 │
│  └──┘ └──┘ └──┘ └──┘ └──┘                    │
│                                               │
│  Erik  •  8 bilder  •  sist: i går            │
│  [Vis alle] [Vis bare nye]                    │
└─────────────────────────────────────────┘
```

«Nye» = bilder registrert siden eieren sist besøkte seksjonen (markeres
som «sett» ved besøk, lagres i `localStorage`).

Fra gjestefeed-visningen kan eieren:
- Rate bilder
- Legge bilder til en collection
- Stacke mot egne bilder (om gjest og eier fotograferte samme motiv)
- Ignorere (bilder forblir i Hotprevue, bare ikke kuratert)

### Privat rom — lesetilgang for gjest

Gjestfotografen kan få tilgang til å *se* bildene fra eventet de var med
på — ikke bare sine egne, men alle. Dette skjer via det private rommet
(ADR-038 / ADR-043-konseptet).

Fra PWA-en: en «Se turbilder»-knapp vises om gjestmaskinen er koblet til
et privat rom. Siden er read-only — gjesten kan bla i bilder, men ikke
endre noe.

---

## Teknisk stack for PWA-en

```
pwa/
  index.html
  src/
    main.tsx
    App.tsx
    pages/
      EnrollPage.tsx       -- invitasjonskode-input
      UploadPage.tsx       -- bildevelger + opplasting
      RoomPage.tsx         -- privat rom, read-only
    lib/
      hotpreview.ts        -- Canvas-basert hotpreview-generering
      hothash.ts           -- SHA-256 via SubtleCrypto
      exif.ts              -- exifr-wrapper
      upload.ts            -- opplastingspipeline mot Hotprevue-API
      auth.ts              -- token-lagring, enrollment
  package.json             -- React, Vite, exifr, Tailwind (subset)
```

Bygget til `pwa/dist/` og servert av Hotprevue-backend:

```python
app.mount("/pwa", StaticFiles(directory="pwa/dist", html=True))
```

Ingen ny server — PWA-en er statiske filer servert av eksisterende
FastAPI-instans.

---

## Begrunnelse

**PWA over native app:** Native app krever Apple Developer-konto,
App Store-review og Android-signering. PWA krever ingen av delene og
dekker brukstilfellet fullt ut (bildeopplasting fra kamerarulle).

**Browser-side bildebehandling:** Konsistent med Hotprevues
kjerneprinsipper (ADR-008): originalfiler forlater aldri klientenheten.
`SubtleCrypto` for SHA-256 og Canvas for resizing er veldefinerte
nettleser-API-er tilgjengelig på alle moderne mobilnettlesere.

**Separat mini-app, ikke del av hoved-frontend:** Hoved-frontend er en
desktop-orientert applikasjon på ~200 komponenter. En gjestbruker trenger
tre skjermbilder. Å bygge det inn som en ny del av hoved-appen gir mer
kompleksitet enn det sparer.

**Gjestefeed som separat inngang:** Å blande gjestbilder inn i eierens
Browse-visning skaper støy. En dedikert feed gjør kurasjonsflyten tydelig:
man går dit når man vil gjennomgå nytt materiale.

---

## Implementeringsplan

| Steg | Fil | Innhold |
|------|-----|---------|
| 1 | `pwa/` | Initialiser Vite + React + Tailwind |
| 2 | `pwa/src/lib/hotpreview.ts` | Canvas-hotpreview + hothash via SubtleCrypto |
| 3 | `pwa/src/lib/exif.ts` | exifr-wrapper, samme felt som backend |
| 4 | `pwa/src/lib/upload.ts` | Opplastingspipeline mot Hotprevue-API |
| 5 | `pwa/src/pages/EnrollPage.tsx` | Invitasjonskode-skjerm |
| 6 | `pwa/src/pages/UploadPage.tsx` | Bildevelger, progresjon, duplikat-visning |
| 7 | `backend/main.py` | Mount `/pwa` → `pwa/dist/` |
| 8 | `frontend/src/features/guests/GuestFeed.tsx` | Gjestefeed i Hotprevue |
| 9 | `frontend/src/components/TopNav.tsx` | Lenke til gjestefeed med badge |
| 10 | `backend/tests/api/test_guest_upload.py` | Enrollment + opplasting + tilgangskontroll |

---

## Avhengigheter

- **ADR-040** (maskinidentitet og invitasjonskode) — må implementeres først
- **ADR-032** (nettverkstilgang uten Tailscale) — gjesttelefoner er typisk
  utenfor eierens nettverk og trenger en offentlig tilgjengelig URL til
  Hotprevue-backend

---

## Konsekvenser

**Gevinst:** En venn kan bidra med bilder til samme event uten å installere
noe, uten brukerkontoer, og uten at eieren mister kontroll over hva som
publiseres. Gjestfotografens navn følger bildene automatisk gjennom
hele flyten.

**Kostnad:** Et nytt mini-frontend-prosjekt å vedlikeholde. Canvas-basert
bildebehandling er tregere enn native — forventet prosesseringstid ~0,5 sek
per bilde på en middels telefon, akseptabelt for manuell bildeopplasting.

**Ikke i scope:**
- Automatisk opplasting i bakgrunnen (krever native app)
- Direktekamera-opptak (velg bilde fra kamerarulle er tilstrekkelig)
- Gjestfotograf kan slette egne bilder
- Gjestfotograf kan se andres bilder uten privat rom-invitasjon
- Varsler til gjest når eier publiserer en collection med gjestens bilder
