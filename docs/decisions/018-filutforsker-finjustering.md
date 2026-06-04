# ADR-018: Filutforsker for finjustering i Lokale verktøy

**Status:** Planlagt  
**Dato:** 2026-06-03

## Kontekst

Lokale verktøy har i dag ett brukstilfelle: flat innstream → organiserte undermapper.
Brukeren åpner en mappe, velger bilder etter dato, lager nye mapper og flytter bildene dit.
Layouten (FolderPanel venstre + PhotoFolderGrid høyre) og flytt-flyten (DestinationPicker)
er designet rundt dette.

Et annet brukstilfelle oppstår etter at initialorganiseringen er gjort:
**finjustering** — flytte bilder mellom eksisterende mapper, dele opp mapper,
slette tomme mapper, gi mapper nytt navn. Dette ligner en generell filbehandler,
men begrenset til bildefiler.

Reglene som gjelder uansett:
- Brukeren ser bare bildefiler; andre filer er usynlige og urørte
- Companion-filer (RAW, JPEG, XMP, sidecar) følger alltid med master ved flytt
- Originalfiler flyttes aldri av backend — kun av den lokale agenten

## Beslutning

### Layout: Enkelt-panel med picker — ikke to-panel

Gjennomgang av sammenlignbare programmer:

| Program | Tilnærming |
|---|---|
| Lightroom Classic | Mappetre venstre + grid høyre, dra-slipp i treet |
| digiKam | Samme; «Move to»-picker i kontekstmeny |
| Adobe Bridge | To-panel mulig, men sjelden brukt |
| FastRawViewer | Enkelt panel + kontekstmeny |

To-panel (to simultane bildegrid) gir lite skjermreell og er komplisert å
koordinere med batch-operasjoner. Picker-mønsteret (`DestinationPicker` som
allerede finnes) er mer egnet for batch-operasjoner på 100+ bilder.

**Beslutning**: Beholde enkelt-panel + picker. Utvide med:
- Undermappeoversikt under toolbaren (bildestall + noen thumbnails per undermappe)
- Mappe-kontekstmeny i FolderPanel (gi nytt navn, slett)

Dra-slipp (fra grid til mappetre) er et naturlig neste steg, men utelates fra
MVP fordi picker er mer eksplisitt og robust for store utvalg.

### Nye endepunkter i lokal agent

**`POST /files/move-batch`**

Tar en liste med masterfilstier og én destinasjonskatalog.
Sjekker *alle* konflikter før første fil flyttes (atomisitetsgaranti).
Returnerer liste over moved + evt. skippet.

```python
class MoveBatchRequest(BaseModel):
    master_paths: list[str]
    destination_dir: str
    on_conflict: Literal["abort", "skip"] = "abort"
```

Erstatter dagens loop i `handleMoveSelected` (N separate HTTP-kall → ett kall).

**`DELETE /files/dir`**

Sletter en mappe. Avviser hvis mappen inneholder bildefiler (IMAGE_SUFFIXES).
Advarer (men tillater) hvis den inneholder andre filer — disse slettes ikke,
bare selve mappen kan fjernes etter at den er tømt av brukeren.

**`POST /files/rename-dir`**

Gir en mappe nytt navn innenfor samme overmappe.

```python
class RenameDirRequest(BaseModel):
    path: str
    new_name: str
```

### Fiks: Atomisitetsbuggen i `move_group`

Nåværende `POST /files/move` sjekker konflikter per fil *underveis* —
hvis fil nr. 3 av 5 kolliderer, er fil 1–2 allerede moved. Dette er en
delvis-gjennomføringsbug.

Fix: Pre-check alle destinasjonsfilnavn (master + alle companions) mot
destinasjonskatalogen før noen fil flyttes.

### Companion-invariant

Companions hentes via `scan_directory` på masterens overmappe. Dette forutsetter
at master og companions alltid ligger i samme katalog — dette er et invariant
som dokumenteres her. Hvis en companion er i en annen katalog, fanges den ikke opp.
Dette anses som et utenfor-scope-scenario; brukeren får da ansvaret.

### Konfliktløsning

To gyldige strategier:

- **`abort`** (standard): Stopp hele operasjonen hvis én fil ville kollidert. Trygt.
- **`skip`**: Hopp over bilder som ville kollidert, rapporter hvilke.

«Rename» (autogenerer nytt navn) utelates fordi det bryter companion-parene:
hvis `IMG_001.JPG` omdøpes til `IMG_001_1.JPG`, henger `IMG_001.XMP` igjen med
feil navn.

### Bilder allerede registrert i Hotprevue

Filer som er registrert i Hotprevue-databasen har en `file_path` som da blir
stale ved filsystemflytting. Coldpreview er hash-basert og upåvirket.

**Scope-avgrensning**: Lokale verktøy forutsetter at bildene *ikke ennå er
registrert*. Bruk søk + batch-operasjoner i BrowseView for å håndtere
allerede registrerte bilder. Gjenfinningsverktøyet i ADR-017 adresserer
opprydding etter utilsiktet flytting.

UI-advarselen «Bilder registrert i Hotprevue bør flyttes via BrowseView» vises
når prescan avdekker at hothash-er tilhørende filer i katalogen er kjent i databasen
(fremtidig: sjekk via `check-hothashes`-endepunktet).

### Prescan ved rask katalognavigasjon

Nåværende prescan kansellerer ikke pågående jobb når brukeren bytter katalog.
Når brukeren navigerer raskt mellom mange mapper, hope mange jobber seg opp.

Fix: `startPrescan` sender `cancel_previous=true` for å kansellere pågående
jobb for samme overmappe-kontekst, eller agenten kansellerer automatisk
når en ny jobb for en annen katalog starter.

## Konsekvenser

### Utenfor scope (MVP)
- Dra-slipp fra grid til mappetre
- Undo/angre
- Rekursiv sletting av undermapper
- Automatisk advarsel om registrerte bilder (krever `check-hothashes` per katalog)
- Rename med companion-synkronisering

### Hva som implementeres

**Backend (lokal agent)**:
1. `POST /files/move-batch` med pre-check og `on_conflict`
2. `DELETE /files/dir` med bildefil-sjekk
3. `POST /files/rename-dir`
4. Fiks atomisitetsbuggen i `POST /files/move`

**Frontend**:
5. Erstatt loop i `handleMoveSelected` med `move-batch`-kall
6. Mappe-kontekstmeny i `FolderPanel`: «Gi nytt navn» + «Slett» (kun hvis ingen bildefiler)
7. Undermappeoversikt under toolbar (bildestall per undermappe, noen thumbnails)

### Eksisterende infrastruktur som gjenbrukes
- `DestinationPicker` — allerede implementert, brukes uendret
- `moveGroup`/`makeDir` i `api/fileops.ts` — ny `moveBatch`-funksjon legges til
- `FolderPanel` + `usePreorganiserStore` — kontekstmeny-funksjonalitet legges til
- Lokal agent prescan-cache — `update_cache_path` oppdateres allerede ved flytt
