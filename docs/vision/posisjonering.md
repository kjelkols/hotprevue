# Hotprevue — posisjonering

**Sist oppdatert:** 2026-06-08

---

## Kjernesetningen

> **Hotprevue er organisasjonslaget for fotoarkiver — det jobber ved siden av
> alt du allerede har, uten å ta over noe.**

---

## Det som skiller Hotprevue fra alle andre

De fleste fotoprogrammer tar eierskap over bildene dine. De kopierer dem
til en ny mappe, laster dem opp til skyen, konverterer dem til egne
formater, eller låser deg inne i en katalog du ikke kan lese uten
programmet. Å bytte verktøy betyr å starte på nytt.

Hotprevue gjør ingen av delene. Det indekserer bilder der de allerede
ligger, beriker dem med metadata, og lar deg organisere, søke og dele —
uten å røre originalfilene.

**Konsekvensen:** Hotprevue kan installeres ved siden av et hvilket som
helst annet system uten konflikt. En bruker med Immich for backup og
Lightroom for redigering kan legge Hotprevue på toppen og få
organisering, flerbrukerbidrag og publisering — uten at Immich eller
Lightroom merker noe.

---

## Hva folk bruker fotoprogrammer til — og hvor Hotprevue passer

| Behov | Typiske verktøy | Hotprevue |
|-------|----------------|-----------|
| Backup og synkronisering | iCloud, Google Photos, Immich | ✗ Ikke dette |
| Bilderedigering | Lightroom, Capture One, darktable | ✗ Ikke dette |
| Organisering og søk | Lightroom, digiKam, Apple Photos | ✓ Kjernen |
| Flerbruker-bidrag | Ingen gode alternativer | ✓ Unikt |
| Deling og presentasjon | Flickr, Smugmug, Pixieset | ✓ Via Imalink |
| Produksjonspipeline | Photo Mechanic, egne skript | ✓ Uutnyttet potensial |

Hotprevue konkurrerer ikke i de to første kategoriene. Det er et bevisst
valg — og det som åpner markedet.

---

## Primærmarkedet: selvhostere med eksisterende oppsett

Den best definerte brukergruppen har allerede løst backup og redigering.
Det de mangler er:

- Strukturert søk på tvers av hele arkivet
- Eventer og collections for organisering
- Bidrag fra familie, venner eller kolleger
- Leveranse til kunder eller publisering uten skyabonnement

En bruker med Immich for backup og Hotprevue for organisering og deling
er en naturlig kombinasjon som ingen annet verktøy tilbyr i dag.

Immich alene har ~50 000 GitHub-stjerner og vokser raskt — det gir et
mål på størrelsen av selvhoster-markedet for bilder. Hotprevue retter seg
mot den delen som vil ha mer enn backup og galleri, men ikke vil gi slipp
på eksisterende oppsett.

---

## Brukerscenarier

### Familie med delt fotoarkiv

Mor, far og barn laster opp fra sine egne telefoner. Alle kan se turbildene,
bryllupsbildene, julefeiringen — organisert i eventer. Ingen skykonto
nødvendig. Originalbildene ligger der de alltid har ligget.

Dette er ADR-042's familiemodell: `member`-tilgang gir automatisk innsyn
i alt som er organisert, uten at eieren aktivt deler hvert album.

### Fotografklubb eller kollektiv

10–50 fotografer dokumenterer det samme motivet over tid — natur, sport,
lokalhistorie, kulturarv. Én administrator kuraterer for utstillinger,
nettsider og årbøker.

Ingen eksisterende løsning kombinerer flerbruker-bidrag med kurert
publisering uten et komplisert brukersystem. Hotprevues invitasjonsmodell
(ADR-040) og `member`-tilgang (ADR-042) er skreddersydd for dette.

### Lokal- og kulturhistorieprosjekter

Fotografering av steder, bygninger, tradisjoner over mange år og av mange
bidragsytere. Eieren av prosjektet kuraterer og publiserer på Imalink.
Originaler forblir hos den som tok bildet.

Eksempel: alle støylene i en kommune fotografert systematisk. Prosjektet
får en offentlig side på Imalink med full fotograf-attribuering og
koblinger til originalkilden via hothash.

### Profesjonell fotograf som leverer til kunder

Fotografen bruker Lightroom for redigering — Hotprevue berøres ikke.
Etter redigering registreres bildene i Hotprevue, en collection opprettes,
og kunden får en passordbeskyttet lenke via Imalink (ADR-038). Kunden
blar i bildene uten å trenge en konto. Originaler forblir på fotografens
maskin.

Sammenligning:
- **Smugmug / Pixieset:** betalt skyabonnement, du laster opp originaler
- **Lightroom delivery:** krever Creative Cloud
- **Hotprevue + Imalink:** selvhostet, originaler forblir dine

### Gjestfotograf på tur

En venn er med på fjelltur og tar bilder med sin telefon. Via en
invitasjonskode (ADR-040) og en PWA (ADR-041) laster hun opp bildene
direkte til eierens Hotprevue-instans — kredittert med sitt eget navn.
Eieren kuraterer og publiserer et utvalg fra turen på Imalink.
Vennens originalbilder forblir på hennes telefon.

### Teknisk fotograf med egne arbeidsflyter

Hotprevue vet tre ting om hvert bilde: hva det er (metadata), hvor det
er (filsti), og hvilken gruppe det tilhører (event, collection, stack).
Det er nok til å generere batch-jobber for eksterne verktøy:

```
Panorama-sammensetning:
  Søk: event="Jotunheimen" + tag="panorama"
  → PTGui-prosjektfil med stier til originalfilene

Fokus-stacking:
  Søk: tag="fokusstack" + stack_id=X
  → Helicon Focus-batchjobb

RAW-konvertering:
  Søk: event="Bryllup Hansen" + rating >= 4
  → darktable-cli eksport av utvalgte bilder

AI-oppskalering:
  Søk: collection="Leveranse"
  → Real-ESRGAN-batchjobb på originalfilene
```

Ingen andre fotoprogrammer eksponerer originalfilstier via søk på denne
måten. Et enkelt eksport-endepunkt som returnerer filstier basert på et
søkekriterie gjør Hotprevue til et naturlig bindeledd i komplekse
arbeidsflyter.

---

## Hvem Hotprevue ikke er for

Like viktig å avklare:

- **Telefonbrukere som vil ha automatisk backup** — for teknisk krevende å
  sette opp
- **Folk som primært trenger bilderedigering** — Hotprevue er ikke en editor
- **Enterprise / kommersiell bruk** — mangler rettighetsstyring, SLA, support
- **Folk uten teknisk interesse** — krever selvhostet server

---

## Forholdet til Imalink

Imalink er publiseringslaget — et separat program som mottar kuratert
innhold fra Hotprevue og gjør det tilgjengelig for omverdenen. Forholdet
er en-veis: Hotprevue er kilden, Imalink er mottakeren.

Imalink gir tre typer tilgang:

- **Offentlig**: anonymiserte bilder (AI-smiley over ansikter), fritt
  tilgjengelig som en vanlig nettside
- **Privat rom**: umodifiserte bilder, tilgjengelig via token-lenke for
  en definert gruppe (deltakere på en tur, kunder)
- **Leveranse**: kuratert collection med valgfri nedlasting

Imalink er ikke en konkurrent til Immich eller Google Photos. Det er en
presentasjonsflate for det som allerede er organisert i Hotprevue.

---

## Det som er genuint nytt

Enkeltdelene av Hotprevue finnes i andre systemer:

| Konsept | Finnes i |
|---------|---------|
| Maskinidentitet via nøkkelpar | Syncthing, WireGuard, Tailscale |
| Invitasjonskode til maskin | Tailscale auth keys |
| Managed users uten egen konto | Plex, Home Assistant |
| Ikke-destruktiv katalogisering | Photo Mechanic (delvis) |

Kombinasjonen — ikke-destruktiv overlay, flerbruker-bidrag via
maskinidentitet, kurert publisering, pipeline-integrasjon — finnes ikke
samlet i noe annet verktøy.

Den ene egenskapen som er helt unik: **«organisert innhold» som
synlighetsregel for familiemedlemmer**. Du bestemmer ikke eksplisitt hva
som er synlig — det følger naturlig av at du legger bilder i eventer og
collections for din egen skyld. Organiseringsarbeidet dobler som
tilgangsstyring.
