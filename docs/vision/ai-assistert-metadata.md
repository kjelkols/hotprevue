# AI-assistert metadata

Brainstorm-dokument. Ikke besluttet, ikke prioritert.

---

## Kjerneprinsipp

AI-resultater er alltid **forslag**. Brukeren godkjenner, avviser eller
korrigerer. Systemet gjør aldri automatiske endringer i metadata uten
bekreftelse. Dette gjelder uansett hvor godt modellen er.

---

## Hva AI kan tilføre

### Beskrivelse og nøkkelord
- Fritekstbeskrivelse av hva bildet viser ("to barn leker i snøen foran et rødt hus")
- Automatiske nøkkelord/tagger (mennesker, dyr, natur, arkitektur, aktivitet, årstid)
- Hendelsestype (bryllup, bursdag, konsert, friluftsliv, portrett)
- Stemning og atmosfære (rolig, dramatisk, festlig)
- Fargepalett

### Teknisk vurdering
- Skarphetsvurdering (nyttig for å velge beste bilde fra en burst)
- Eksponering (over/undereksponert)
- Komposisjonsvurdering
- "Beste bilde"-forslag fra en stack

### Tekst i bilder (OCR)
- Skilt, menyer, whiteboards, bøker, reklameplakater
- Nyttig for søk: "finn bildet der det stod 'Støylen Gard'"
- Tekstinnhold lagres som søkbart felt, ikke visuelt

### Persongjenkjenning
- Ansiktsdeteksjon (er det mennesker i bildet?)
- Ansiktsklynging (gruppere bilder av samme person uten å navngi dem)
- Navngiving er alltid brukerens valg — systemet foreslår "denne personen
  dukker opp i 47 bilder, vil du gi vedkommende et navn?"
- Sensitiv funksjon — GDPR-implikasjoner, se eget avsnitt

### Stedsbeskrivelse
- Ikke GPS-koordinater (det er EXIF), men visuell stedstolkning:
  "innendørs", "fjord", "bygate", "skog", "strand", "fjell"
- Kan kombineres med GPS-data for å gi rikere beskrivelse:
  GPS → "Gloppen kommune" + AI → "fjordlandskap med snødekte fjell"

### Naturlig språk-søk
- Brukeren skriver: "finn bilder av barn som leker ute om sommeren"
- Systemet finner relevante bilder uten at de er manuelt tagget
- Krever enten semantiske vektorembeddings (CLIP) eller spørring til
  sky-AI per søk

---

## Tekniske tilnærminger

### Sky-AI (Claude Vision, GPT-4V, Gemini Vision)
**Fordeler:** Meget høy kvalitet, forstår kontekst og nuanse, kan gi
rike beskrivelser på norsk, ingen lokal GPU nødvendig.

**Ulemper:** Bildene forlater maskinen — privacy-implikasjon. Koster
penger per bilde. Krever internettforbindelse. Uegnet for bilder
brukeren ikke vil sende ut.

**Bruksscenario:** Opt-in per bilde eller per samling. Brukeren velger
eksplisitt hvilke bilder som sendes til sky-AI.

---

### Lokale modeller (Ollama + LLaVA, MiniGPT-4)
**Fordeler:** Ingenting forlater maskinen. Ingen løpende kostnader.
Fungerer offline.

**Ulemper:** Krever GPU for akseptabel hastighet (CPU-kjøring er meget
tregt). Lavere kvalitet enn sky-modeller. Modellfilene er store (4–20 GB).

**Bruksscenario:** Brukere med egen GPU (gaming-PC, Mac M-serie).
Batchprosessering over natten.

---

### CLIP — semantiske bildeembeddings
CLIP (Contrastive Language-Image Pretraining) koder bilder og tekst inn
i samme vektorrom. Et bilde av en hund og teksten "hund" havner nær
hverandre i rommet.

**Hva dette muliggjør:**
- Semantisk søk uten manuell tagging: skriv et søk, systemet finner
  visuelle treff
- "Finn bilder som ligner på dette bildet" (innholdsbasert, ikke bare
  metadata)
- Stille, rask klassifikasjon: er dette et portrett? utendørs? mat?

**Teknisk:** CLIP-modeller (ViT-B/32 el.l.) er relativt små (300–600 MB)
og kan kjøres på CPU med akseptabel hastighet for enkeltbilder. Embedding
genereres én gang ved registrering og lagres i databasen (512 float32 =
~2 KB per bilde). PostgreSQL `pgvector`-extension støtter
cosine-similarity-søk.

**Dette er sannsynligvis det lavest-hengende frukten av alt her.**

---

### Hybrid-tilnærming
- CLIP lokalt for embeddings og semantisk søk (ingen privacy-bekymring)
- Sky-AI for rike beskrivelser og nøkkelord, kun for bilder brukeren
  velger å sende

---

## Metadata-lagring

AI-genererte felt bør skilles fra bruker-skrevet metadata:

```
tags:
  - value: "snø"
    source: "user"
  - value: "vinter"
    source: "ai:clip"
    confidence: 0.91
  - value: "fjell"
    source: "ai:claude"
    confirmed: false   ← ikke bekreftet av bruker ennå
```

**Fordeler med kildemarkering:**
- Brukeren ser hva som er AI-forslag vs. egne valg
- Kan vise "ubekreftede forslag" samlet for gjennomgang
- Kan fjerne alle AI-forslag for et bilde uten å miste brukerens egne tagger
- Tillater fremtidig finjustering/evaluering av AI-kvalitet

---

## Ansiktsgjenkjenning — særskilt vurdering

Ansiktsgjenkjenning er teknisk mulig men krever spesiell behandling:

**Hva som er greit:**
- Detektere at det finnes ansikter i bildet (ja/nei, antall)
- Klynge bilder av samme person uten å navngi (kun intern ID)

**Hva brukeren bestemmer:**
- Navngiving av klynger (dette er fotograf som kobler AI-klynge til navn)
- Om ansiktsdata i det hele tatt skal behandles

**GDPR og personvern:**
- Ansiktsdata er biometriske data — særlig beskyttet kategori
- For enbruker-system på egne bilder: lavere terskel
- Hvis systemet noen gang deles (Hotprevue Global): krevende regelverk
- Ansiktsgjenkjenning bør være opt-in, tydelig avgrenset, og lett å deaktivere

---

## Brukeropplevelse

### Registreringsflyt med AI
```
Registrering fullført → N bilder registrert
  → "Vil du berike bildene med AI-genererte forslag?"
     [Ja, send til sky-AI]  [Ja, bruk lokal modell]  [Nei takk]
  → AI prosesserer i bakgrunnen
  → Notifikasjon: "47 bilder klar for gjennomgang"
  → Bruker åpner "AI-forslag"-visning
  → Per bilde: godkjenn alle / godkjenn noen / avvis alt
```

### Retrospektiv berikelse
Brukeren kan berike eksisterende bilder i ettertid. Nyttig for store
arkiver som ble registrert før AI-funksjonen fantes.

### Naturlig språk-søk i søkegrensesnittet
Dagens søk er kriteriebasert (felt + verdi). Med CLIP-embeddings:
- Fritekstfelt: "snødekte fjell ved solnedgang"
- Systemet returnerer bilder sortert etter semantisk likhet
- Kan kombineres med vanlige filtre (dato, fotograf, hendelse)

---

## Arkitektur

**Prosessering skjer i klientagenten** — den har tilgang til originalfiler
og hotpreviews. Backend mottar og lagrer resultatene, men kjører aldri
AI-modeller selv.

For sky-AI: klientagenten sender hotpreview (150×150) eller en skalert
versjon til API. Originalen forlater aldri maskinen.

For CLIP: klientagenten kjører modellen lokalt, genererer embedding-vektor,
sender kun vektoren til backend. Ingen bildebytes til backend for dette.

**Asynkron kø:** AI-prosessering bør aldri blokkere registrering. En enkel
oppgavekø i klientagenten (SQLite-basert) håndterer rekkefølge og retry.

---

## Hva andre gjør

| Program | AI-funksjon |
|---------|-------------|
| Apple Photos | Ansiktsgjenkjenning, scenegjenkjenning, "Minner", semantisk søk |
| Google Photos | Samme + tekstsøk i bilder (OCR), automatiske album |
| Lightroom (sky) | Semantiske tagger, ansiktsgjenkjenning |
| digiKam | Ansiktsgjenkjenning lokalt (OpenCV) |
| Immich | Ansiktsgjenkjenning + semantisk søk (CLIP lokalt) |

Immich er den nærmeste sammenligningen — open source, self-hosted,
med lokal CLIP og ansiktsgjenkjenning. Hotprevue kan lære av deres
implementasjon uten å kopiere deres filosofi (de eier filene, vi gjør ikke).

---

## Mulige første steg

Ikke besluttet — kun notert for fremtidig diskusjon:

1. **CLIP-embeddings** ved registrering (lokal, ingen privacy-bekymring,
   muliggjør semantisk søk) — relativt avgrenset endring
2. **AI-forslag-UI** — en gjennomgangsvisning for ubekreftede forslag,
   uavhengig av hvilken AI-kilde som genererte dem
3. **Sky-AI opt-in** for enkeltbilder eller samlinger — brukeren velger
   eksplisitt
4. **Ansiktsklynging** — først uten navngiving, kun "denne personen
   finnes i disse bildene"
