# Filforsonning og filhelse

Dette dokumentet beskriver strategien for å holde databasens filstier i samsvar med
brukerens faktiske filstruktur over tid — og for å gjenopprette koblinger når filer er
blitt flyttet, omdøpt eller reorganisert.

---

## Problemet

Hotprevue lagrer absolutte filstier ved registrering. Brukeren kan fritt flytte, omdøpe
eller reorganisere originalfilene sine — systemet har ingen kontroll over dette og det er
tilsiktet. Resultatet er at lagrede stier kan bli ugyldige:

- Disk flyttes eller omdøpes (`D:\Bilder` → `E:\Bilder`)
- Mappe reorganiseres (`/Bilder/2024` → `/Arkiv/2024/Bilder`)
- Fil omdøpes
- Backup kopieres til ny maskin med annen stistruktur

Uten et verktøy for å håndtere dette mister brukeren gradvis tilgang til originalene fra
Hotprevue — selv om filene faktisk finnes på maskinen.

---

## Stabil identitet som fundament

`hothash` er SHA256 av hotpreview-JPEGen — et innholdsbasert fingeravtrykk som er uavhengig
av filsti, filnavn og disk. Dette er nøkkelen: selv om stien er feil kan systemet verifisere
at en funnet fil er *den riktige filen* ved å regenerere hotpreview og sammenligne hashen.

```
hothash = SHA256(hotpreview_bytes)  ← avhenger kun av bildeinnhold
file_path = "/mnt/d/Bilder/..."    ← kan bli ugyldig
```

Kombinert med EXIF-metadata (nøyaktig dato, kameramodell) og filstørrelse gir dette et
sterkt fundament for automatisk gjenfinn uten å lese hele bildeinnholdet.

---

## Datamodell-utvidelse

`image_files` bør utvides med to kolonner:

| Kolonne | Type | Formål |
|---|---|---|
| `file_size_bytes` | `BIGINT NULL` | Rask matching uten fillesing. NULL for eksisterende rader. |
| `last_verified_at` | `TIMESTAMPTZ NULL` | Sist bekreftet gyldig. NULL = aldri verifisert. |

`file_size_bytes` er særlig verdifull: filnavn + EXIF-dato + filstørrelse gir tre
uavhengige signal som nesten alltid identifiserer én spesifikk fil.

Eksisterende rader får NULL i begge felt. `file_size_bytes` fylles ved neste
verifisering (backenden leser størrelsen fra disk og lagrer den).

---

## Fire kjernefunksjoner

### 1. Verifisering

Sjekk hvilke lagrede stier som fortsatt eksisterer på disk.

**API:**
```
POST /files/verify
→ { ok: 4102, missing: 89, unreadable: 3 }

GET /files?status=missing
→ [{ hothash, file_path, file_type, registered_at, ... }, ...]
```

Verifisering kan kjøres:
- Manuelt fra UI
- Automatisk ved oppstart (asynkront, ikke blokkerende)
- Planlagt (f.eks. én gang per dag)

`last_verified_at` oppdateres for hvert ImageFile som sjekkes OK, og `file_size_bytes`
fylles inn om det mangler.

---

### 2. Gjenfinn flyttede filer

Gitt en katalog å søke i, finn filer som matcher bilder med ugyldige stier.

**Matchingalgoritme (i prioritert rekkefølge):**

1. **Filnavn + EXIF-dato + størrelse** — tre signal, svært høy konfidens
2. **Filnavn + EXIF-dato** — to signal, høy konfidens
3. **Filnavn alene** — lavere konfidens, krever brukerbekreftelse
4. **Bekreftelse via hothash** — backenden regenererer hotpreview fra funnet fil
   og sammenligner med lagret hothash. Gir 100 % sikkerhet, men koster én full
   bildelesing per kandidat.

```
POST /files/find-moved
Body: { search_path: "/mnt/e/Bilder", recursive: true }
→ {
    found: [
      {
        image_file_id: "...",
        old_path: "/mnt/d/Bilder/2023/IMG_4821.NEF",
        found_path: "/mnt/e/Bilder/2023/IMG_4821.NEF",
        confidence: "high",   // "confirmed" | "high" | "medium" | "low"
        matched_by: ["filename", "exif_date", "file_size"]
      }
    ],
    not_found: 12
  }
```

Brukeren ser forslagene med konfidensgrad og bekrefter — individuelt eller i bulk.
Konfidensgrad `confirmed` (hothash-verifisert) kan aksepteres automatisk uten
brukerbekreftelse.

---

### 3. Sti-prefiks-oppdatering

Batch-oppdatering for tilfeller der en hel samling er blitt tilgjengelig på en ny sti.
Det vanligste scenarioet: diskbytting eller synkronisering til ny maskin.

```
POST /files/repath
Body: {
  old_prefix: "/mnt/d/Bilder",
  new_prefix: "/mnt/e/Bilder",
  dry_run: true
}
→ {
    would_update: 3841,
    examples: [
      { old: "/mnt/d/Bilder/2023/IMG_001.NEF",
        new: "/mnt/e/Bilder/2023/IMG_001.NEF" }
    ]
  }
```

`dry_run: true` viser hva som vil skje uten å gjøre endringer. Brukeren bekrefter,
kjøres på nytt med `dry_run: false`.

Oppdaterer `image_files.file_path` for alle rader der stien starter med `old_prefix`.
Setter `last_verified_at = NULL` for oppdaterte rader (krever ny verifisering).

---

### 4. Lagringsanalyse

Aggregert oversikt over filsamlingen som helhet.

```
GET /files/stats
→ {
    total_files: 12841,
    total_size_bytes: 892441600000,  // om file_size_bytes er fylt
    by_type: { RAW: 6203, JPEG: 5901, XMP: 432, TIFF: 305 },
    missing: 89,
    never_verified: 3201,
    duplicate_copies: 234,           // fra duplicate_files
    top_directories: [
      { path: "/mnt/d/Bilder/2024", count: 1842 },
      ...
    ]
  }
```

Nyttig for å forstå samlingens omfang og tilstand. Bygger på eksisterende
`duplicate_files`-tabell for duplikatstatistikk.

---

## Frontend: Filhelse-siden

En dedikert side eller innstillingsfane som presenterer filsamlingens helsetilstand.

```
┌──────────────────────────────────────────────────────┐
│  Filhelse                                             │
├──────────────────────────────────────────────────────┤
│  ● 4 102 filer OK    ○ 89 mangler    ⊘ 3 ulesbare    │
│                                      [Verifiser nå]  │
├──────────────────────────────────────────────────────┤
│  Manglende filer                                     │
│  ─────────────────────────────────────────────────   │
│  [Søk etter flyttede filer…] [Oppdater sti-prefiks]  │
│                                                      │
│  IMG_4821.NEF   /mnt/d/Bilder/2023/   [Finn] [Sett] │
│  IMG_4822.NEF   /mnt/d/Bilder/2023/   [Finn] [Sett] │
│  DSC_0012.CR2   /mnt/d/Bilder/2022/   [Finn] [Sett] │
│  ...                                                 │
└──────────────────────────────────────────────────────┘
```

**«Søk etter flyttede filer»** åpner FileBrowser for å velge søkekatalog, kjører
`find-moved` og viser forslagene med konfidensgrad. Brukeren bekrefter enkeltvis
eller velger «Godta alle høy/bekreftet konfidensgrad».

**«Oppdater sti-prefiks»** åpner en enkel dialog med to felt: gammelt prefiks og nytt
prefiks, med forhåndsvisning av antall berørte filer (via `dry_run`).

---

## Relasjon til `duplicate_files`

`duplicate_files` registreres allerede ved registrering — filer som ble funnet å ha
samme hothash som en allerede registrert fil. Disse er en naturlig del av
lagringsanalysen: brukeren kan se hvor mange kopier som eksisterer og hvilke stier
de ligger på.

I en fremtidig fase kan man la brukeren «adoptere» en duplikatsti som ny primærsti —
nyttig om originalstien er tapt men en kopi fortsatt eksisterer.

---

## Implementasjonsfaser

### Fase 1 — Datagrunnlag
- Migrasjon: legg til `file_size_bytes` og `last_verified_at` på `image_files`
- `POST /files/verify` — sjekk eksistens, fyll inn `file_size_bytes`, oppdater `last_verified_at`
- `GET /files?status=missing` — hent bilder med ugyldige stier

### Fase 2 — Retting
- `POST /files/repath` med `dry_run`-støtte
- `PATCH /image-files/{id}/path` — manuell oppdatering av én sti

### Fase 3 — Gjenfinn
- `POST /files/find-moved` — matchingalgoritme med konfidensgrad
- Bulk-godkjenning av funn i frontend

### Fase 4 — Analyse og UI
- `GET /files/stats` — lagringsanalyse
- Filhelse-siden i frontend

---

## Hva som ikke skal gjøres

- **Systemet skal aldri flytte, omdøpe eller slette originalfiler.** Kun filpekere i
  databasen oppdateres.
- **Ingen automatisk sti-oppdatering uten brukerbekreftelse**, med unntak av
  hothash-bekreftede funn der brukeren har valgt «godta automatisk».
- **Ingen nettverks-basert filscanning** — kun lokalt filsystem tilgjengelig for backend.
