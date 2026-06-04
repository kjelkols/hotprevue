# ADR-020: XMP sidecar ved registrering

**Status:** Planlagt  
**Dato:** 2026-06-04

## Kontekst

Hotprevue lagrer metadata i PostgreSQL og aldri i originalfilene. `file_path` i
`image_files`-tabellen blir stale hvis brukeren flytter eller gir nytt navn til
filer etter registrering (ADR-017). Gjenfinning via `file_content_hash` (SHA256
av originalfil) er mulig men treg for store samlinger — SHA256 må beregnes for
hver fil ved skanning.

Ideen: skriv hothash og sentral metadata til en XMP sidecar ved registrering.
Filen bærer da et unikt merke som kobler den tilbake til databasen, uten at
originalfilen røres.

Vurderinger som inngår i denne ADR:
- Interoperabilitet med Lightroom, digiKam og andre DAM-programmer
- Kollisjonskrisiko for XMP-felt
- JPEG versus RAW
- Hotpreview og coldpreview

## Beslutning

### Sidecar skrives for alle filtyper — valgfritt

Registrering kan skrive en XMP sidecar som en **valgfri innstilling** brukeren
aktiverer eksplisitt. Standard er av. Filer på skrivebeskyttet filsystem (NAS
med read-only mount, optisk disk) fungerer uansett — sidecar-skriving feiler
stille og registreringen fortsetter.

| Filtype | Sidecar-fil | Merknad |
|---------|-------------|---------|
| RAW (NEF, CR3, ARW, DNG, …) | `IMG_001.xmp` | Sidecar er allerede etablert for rotasjon (ADR-016) |
| JPEG | `IMG_001.xmp` | Uvanlig, men teknisk harmløst for andre programmer |
| PNG, TIFF, HEIC | `IMG_001.xmp` | Som JPEG |

JPEG-sidecar er ikke standard — Lightroom og Apple Photos leser ikke sidecar for
JPEG. Den er nyttig utelukkende for Hotprevues egne verktøy (gjenfinning,
re-indeksering). Dette dokumenteres tydelig i UI.

### Kun `hotprevue:`-namespace — aldri standard felt

Sidecaren berører **aldri** `tiff:Orientation` eller andre standard XMP-felt.
Orientering er Lokale verktøys ansvar (ADR-016) og håndteres separat.
Registreringssidecaren skriver utelukkende til et custom namespace:

```xml
<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/">
  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
    <rdf:Description rdf:about=""
      xmlns:hotprevue="https://hotprevue.app/xmp/1.0/"
      hotprevue:hothash="a3f8c2d1..."
      hotprevue:registeredAt="2026-06-04T10:23:00"
      hotprevue:photographer="Kjell Kolsaker"/>
  </rdf:RDF>
</x:xmpmeta>
<?xpacket end="w"?>
```

Andre programmer ignorerer `hotprevue:`-namespacet og skriver det tilbake
uendret (forutsatt XMP-spec-kompatibel implementasjon).

### Eksisterende sidecar bevares

Hvis `IMG_001.xmp` allerede finnes (f.eks. fra rotasjon i Lokale verktøy):
- Les full XML
- Finn eller opprett `rdf:Description`-element med `hotprevue:`-namespace
- Skriv kun `hotprevue:`-feltene — rør ikke andre felt
- Skriv tilbake komplett XML

Denne les-og-bevar-strategien sikrer at Lightroom-innstillinger (`crs:`),
digiKam-tagger (`digiKam:`), og rotasjonsdata (`tiff:Orientation`) ikke overskrives.

### Felt i sidecaren

| Felt | Verdi | Formål |
|------|-------|--------|
| `hotprevue:hothash` | SHA256 av hotpreview | Unik ID — kobler fil til database |
| `hotprevue:registeredAt` | ISO 8601 timestamp | Når filen ble registrert |
| `hotprevue:photographer` | Fotografnavn (streng) | Attribusjon |

Felt som **ikke** skrives til sidecar: event, samling, tagger, rangeringer.
Disse tilhører databasen og kan endre seg over tid.

### Interoperabilitet med andre DAM-programmer

**Lightroom Classic:**
- Bruker samme navnekonvensjon (`filename.xmp`) for RAW
- Leser og bevarer ukjente namespacer ved lagring (verifisert i moderne versjoner)
- Skriver `tiff:Orientation` og `crs:`-felt — ingen konflikt siden Hotprevue
  ikke rører disse
- For JPEG: Lightroom skriver embedded XMP i JPEG-filen, leser ikke sidecar

**digiKam:**
- Samme navnekonvensjon som Lightroom
- Skriver ratings, tagger, faces under `digiKam:`- og `xmp:`-namespace
- Bevarer ukjente namespacer

**darktable:**
- Bruker `IMG_001.NEF.xmp` (beholder original-suffiks) — ingen navnekonflikt
  med Hotprevue-sidecar

**RawTherapee:**
- Bruker `.pp3`-suffiks — ingen konflikt

**Capture One:**
- Eget katalogformat, ingen XMP-sidecar i normal bruk — ingen konflikt

### Kollisjonsoversikt

| Situasjon | Risiko | Konsekvens |
|-----------|--------|-----------|
| Lightroom lagrer RAW-innstillinger | Lav | `hotprevue:`-felt bevares |
| Lightroom og Hotprevue roterer samme fil | Reell | Sist skrevne `tiff:Orientation` vinner — men Hotprevue skriver dette kun fra Lokale verktøy, ikke fra registreringssidecar |
| Sidecar kopieres uten originalfil | Ingen | Ufarlig |
| Originalfil kopieres uten sidecar | Lav | Gjenfinning via `file_content_hash` fungerer fortsatt (tregere) |

### Gjenfinningsverktøy (kobling til ADR-017)

Med `hotprevue:hothash` i sidecar kan gjenfinning skje i to trinn:

```
1. Les hothash fra sidecar (XMP-parse, millisekunder per fil)
2. Slå opp i database → file_path oppdateres
```

uten å generere nytt hotpreview. Dette er vesentlig raskere enn SHA256-skanning
av filinnhold ved store samlinger. `file_content_hash`-skanning er fallback
for filer uten sidecar.

### Hotpreview og coldpreview

Hotpreview er en intern thumbnail (150×150px) — ingen EXIF-metadata skrives.
Coldpreview er et sentralt JPEG som kan lastes ned og åpnes i andre programmer.
Embedding av sentrale metadata (dato, kamera, GPS, fotograf) i coldpreview-EXIF
behandles som eget tema og er ikke del av denne ADR.

## Konsekvenser

### Hva som må implementeres

1. **Innstilling:** `write_registration_sidecar: bool` i brukerinnstillinger
   (database + SettingsPage i frontend)

2. **Klient-agent:** Ny funksjon `write_hotprevue_sidecar(file_path, hothash,
   registered_at, photographer)` i `client/agent/routers/` — skrives etter
   at registrering er bekreftet av backend

3. **Les-og-bevar:** XML-håndtering som bevarer eksisterende felt ved oppdatering
   (kan gjenbruke mønster fra `_write_xmp_orientation` i `files.py`)

4. **Feilhåndtering:** Sidecar-skriving feiler stille — loggføres men stopper
   ikke registreringen

5. **Gjenfinning (fremtidig):** Verktøy i Lokale verktøy som leser
   `hotprevue:hothash` fra sidecar og oppdaterer `file_path` i databasen

### Ikke i scope

- Sidecar-skriving for allerede registrerte bilder (backfill)
- Oppdatering av sidecar ved endring av fotograf, event, tagger
- Embedding av metadata i coldpreview-EXIF (eget tema)
- Validering av sidecar-integritet over tid
