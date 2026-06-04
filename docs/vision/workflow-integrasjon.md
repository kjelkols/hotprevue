# Hotprevue i samspill med fotografens workflow

Dette er et brainstorm-dokument. Ideene er ikke besluttet og har ingen prioriteringsrekkefølge.
Formålet er å ha et sted å komme tilbake til når vi skal tenke på hva Hotprevue skal bli
på lengre sikt.

---

## Utgangspunkt: hva Hotprevue er og ikke er

Hotprevue eier ikke filene. Det eier ikke editeringsstaten. Det er en **indeks** —
en permanent, søkbar, allestedsnærværende indeks over hva fotografen har skutt.

Dette er ikke en svakhet. Det er en arkitektonisk styrkeposisjon: systemet kan
eksistere *side om side* med alle andre verktøy uten å konkurrere med dem.
Lightroom eier editeringen. Capture One eier katalogen. Photoshop eier retusjeringen.
Hotprevue eier sporbarheten og tilgjengeligheten.

---

## Fotografens fillivssyklus

Filene er ikke statiske. De beveger seg gjennom tilstander:

```
Kamera → SD-kort
  → Import til disk (rename, mappestruktur)
  → Culling / triage (velg keeper, slett rejects)
     — i Lightroom, FastRawViewer, Finder, Utforsker
  → Orientering / rotasjon
     — i kamera, telefon, Windows Utforsker, Lokale verktøy
  → RAW-utvikling (Lightroom, Capture One, darktable)
  → Retusjering (Photoshop) → PSD → eksportert JPEG
  → Leveranse (resizede JPEGs, web-eksport, utskrift)
  → Arkivering (originaler til NAS / Bluray / Glacier)
```

Hotprevue posisjonerer seg i dag mellom import og registrering. Men verdien
forsterkes, ikke svekkes, etter hvert som editering skjer — fordi sporingen
tilbake til råbildet blir mer verdifull jo lengre tid som går.

---

## Fotografarketyper

### Hobbyfotograf / familiefotograf
Skyter JPEG, redigerer minimalt. Primærbehov: *finn bildet igjen om 10 år*.
Hotprevue som permanent, søkbar arkivindeks dekker hele behovet.
Ingen konkurranse fra Lightroom her.

### Entusiast med RAW-workflow
Skyter RAW, utvikler i Lightroom eller darktable. Lightroom er svak på
spørsmål som "vis meg alt jeg skjøt sommeren 2019 — inkludert det jeg
aldri utviklet". Hotprevue som komplett RAW-register med hendelser og
fri-tekst-søk er komplementær, ikke konkurrerende.

### Profesjonell / evenementfotograf
Skyter RAW+JPEG, leverer raskt. Trenger culling, leveranselister, sporing
av hva som er levert til hvem. Hotprevue med samlinger og hendelser er
organiseringslaget. Editeringsverktøyet tar seg av piksler.

### Arkivar / familiehistoriker
Digitaliserte analogbilder, bilder fra mange kilder og epoker. Ingen aktiv
editering — bare *finne, koble, bevare*. Hotprevue er primærverktøy, ingen
andre verktøy nødvendig.

---

## Ideer for samspill

### 1. Les eksisterende XMP-metadata ved registrering

Lightroom, darktable og digiKam skriver ratings (`xmp:Rating`), fargemerker
(`xmp:Label`) og nøkkelord (`dc:subject`) til XMP. Når Hotprevue registrerer
en fil med eksisterende sidecar, kan disse leses inn automatisk:

- `xmp:Rating` → Hotprevues rating
- `dc:subject` / `lr:hierarchicalSubject` → Hotprevues tagger
- `xmp:Label` → fargekategori eller tagg

Brukeren trenger ikke re-tagge i Hotprevue det som allerede er gjort i
Lightroom. Registrering blir en *import av eksisterende arbeid*, ikke et
blankt ark.

**Forutsetning:** Denne lesingen skjer i klientagenten (som har
filsystemtilgang). Logikken er enkel XML-parsing av samme type som
XMP-sidecar-håndteringen vi allerede har.

---

### 2. Versjonskjeding — koble utviklede eksporter til RAW-original

En RAW utvikles i Lightroom → eksportert JPEG. Disse er to representasjoner
av samme motiv. Hotprevue kan knytte dem via perceptuell hash.

Brukeren registrerer JPEGen. Systemet sammenligner pHash/dHash mot eksisterende
registreringer og foreslår: *"Dette ligner på RAW-filen IMG_1234.NEF —
er dette en utviklet versjon?"*

Brukeren bekrefter eller avviser. Ingen automatikk.

Resultatet: en fotopost i Hotprevue kan ha en RAW-original og én eller flere
avledede versjoner — alle søkbare og tilgjengelige fra samme post.

**Teknisk forutsetning:** pHash og dHash er allerede beregnet og lagret
(ADR-004). Mangler: UI for versjonkobling og en "liknende bilder"-spørring
mot databasen.

---

### 3. Watch folder — automatisk registrering

I stedet for manuell registrering: klientagenten overvåker utvalgte mapper.
Nye filer registreres automatisk i bakgrunnen etter at de dukker opp.

Brukeren jobber i Lightroom som normalt — eksporterer JPEG til en watch-mappe
— Hotprevue plukker dem opp uten brukerinteraksjon.

**Fordel:** Fjerner friksjon fullstendig for etablerte workflow.
**Utfordring:** Hva skjer med ufullstendige filer som skrives midtveis?
Race condition må håndteres (stabil filstørrelse over N sekunder el.l.).

---

### 4. Lightroom-katalog som import

Lightroooms katalog er en SQLite-database (`Lightroom Catalog.lrcat`).
En konverter kan lese:
- Album/samlingshierarki → Hotprevue-hendelser og samlinger
- Keywords → tagger
- Ratings og fargemerker
- Capture time og kamerainfo

Brukeren beholder alt Lightroom-arbeid, men får Hotprevues tilgjengelighet
og RAW-sporing på toppen. Én-veis import — Hotprevue skriver ikke tilbake
til Lightroom-katalogen.

**Utfordring:** Lightrooms katalogformat er udokumentert men godt utforsket
av open source-prosjekter (lrcatlib m.fl.). Skjemaet endres mellom versjoner.

---

### 5. Bi-direksjonell XMP-sync

Hotprevues metadata (tagger, rating, hendelse) kan skrives tilbake til
XMP-sidecar — enten ved eksplisitt brukerhandling eller automatisk.

Dette gjør Hotprevues organiseringsarbeid synlig i Lightroom, digiKam og
andre program som leser XMP. Brukeren gjør jobben én gang — alle verktøyene
ser resultatet.

**Utfordring:** Kollisjonshåndtering (ADR-020 dekker dette for hothash —
det samme gjelder for ratings og tagger). "Sist skrevne vinner" er ikke
alltid riktig.

---

### 6. Perceptuell søk og gjenfinning

Med pHash/dHash lagret per bilde kan Hotprevue svare på:
- "Finn alle bilder som ligner på dette" (stack-forslag)
- "Er dette bildet allerede registrert?" (selv om filen er konvertert el. eksportert)
- "Koble denne JPEGen til sin RAW-original"

Hamming-avstand mellom pHash-verdier er allerede gjennomtenkt (ADR-004).
Mangler: et søkegrensesnitt og en effektiv indekseringsstruktur (BKTREE el.l.)
for store samlinger.

---

### 7. Companion-konseptet utvidet

Dagens companions er RAW + JPEG + XMP skutt sammen. Men en fil har et
lengre liv:
- PSD fra retusjering er en companion til RAW-originalen
- Eksportert JPEG er en companion
- TIFF fra skanning av analog film er en companion til negativet

Companion-konseptet kan utvides til å dekke hele fillivssyklusen, ikke
bare det som ble skapt av kameraet.

---

### 8. IPTC-kompatibilitet for profesjonell bruk

IPTC er bransjestandardformatet for fotometadata — brukt av pressebyråer,
museer og bildebyrå. Felt som `Creator`, `Copyright`, `Description`,
`Keywords`, `Location` er del av standarden.

Hvis Hotprevue lagrer og eksporterer IPTC-kompatible felt, er systemet
interoperabelt med et bredere profesjonelt økosystem — inkludert salg via
bildebyrå, levering til redaksjoner, og arkivering i institusjonelle systemer.

---

## Den store ambisjonen

Ingen eksisterende verktøy svarer godt på:

> *"Jeg har 200 000 bilder fra 20 år. Finn alle portrettbilder av Sara
> fra 2018–2022, vis meg hvilke jeg har levert, åpne originalen — selv
> om den er på en Bluray i skapet."*

Lightroom mister deg når disken er frakoblet. Skybaserte tjenester krever
at du laster opp alt. Hotprevue — med server-backend, offline-arkivsporing
(ADR-017), perceptuell søk, versjonskjeding, hendelser og samlinger —
kan svare på dette presist.

---

## Ideer som bevisst holdes utenfor Hotprevue

- **Editering av bilder** — Hotprevue er aldri et editeringsverktøy
- **Lagring av originaler** — prinsippet om å aldri flytte filer er ikke
  til forhandling
- **Multi-bruker med tilgangsstyring** — dette tilhører Hotprevue Global
  (se `future.md`), ikke lokal instans
