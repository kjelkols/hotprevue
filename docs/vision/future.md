# Fremtid og store ideer

Dette er et tankekart over muligheter som ikke er besluttet, men som kan forme systemets retning.

---

## Hotprevue Global — et publiseringslag

### Bakgrunn og motivasjon

Imalink var et forsøk på et sentralisert multi-bruker-system der fotografer kunne registrere og dele bilder via en felles VPS. Erfaringen viste at det er uhåndterlig å være avhengig av en ekstern server for private bilder, og at ansvaret for andres metadata er for tyngt å bære. Immich løser noe av dette, men tar kontroll over hvordan bildene lagres — i strid med Hotprevues kjernephilosofi.

Løsningen er en tydelig todelt arkitektur:

- **Hotprevue (lokalt)** — privat, enkeltbruker, kjører på egen maskin. Full funksjonalitet for å administrere, organisere og utforske egne bilder.
- **Hotprevue Global** — et separat, offentlig publiseringslag der fotografer kan publisere et utvalg av bilder og collections til allmenn oppdagelse.

### Hva Global er

Global er ikke en skylagring. Det er en metadata- og oppdagelsesdatabase. Den inneholder:
- hothash og hotpreview (150×150) for publiserte bilder
- Fotograf/author-informasjon og copyright
- Beskrivelse og collections
- En kontaktmekanisme mellom publikum og fotograf

Originaler forblir alltid på fotografens maskin. Global letter oppdagelse og kontakt — ikke lagring.

### Brukseksempel: Støylene i Gloppen

En fotograf har samlet bilder fra alle støylene i Gloppen over mange år. Via Hotprevue Global publiserer han samlingen som en tematisk collection. Han lager en dedikert nettside for prosjektet — nettsiden henter bilder fra Global API. Hvert bilde har copyright-informasjon og author innbakt. En besøkende som vil bruke et bilde kan kontakte fotografen via Global, og via hothash kan han finne mer informasjon om bildet.

### hothash som permanent koblingspunkt

hothash er en inneholdsbasert ID — SHA256 av hotpreview-bytene. Det gir:
- En deterministisk, verifiserbar lenke mellom lokalt og globalt
- Naturlig duplikatdeteksjon
- Mulighet for permanente lenker fra eksterne nettsider til Global-oppføringen

**Viktig designbeslutning:** hothash må låses ved publiseringstidspunktet og lagres eksplisitt i lokal DB som "publisert hothash". Hvis hotpreview-genereringen endres lokalt (ny algoritme, ny versjon av Pillow), endres hothash — men den globale posten skal forbli uendret og sporbar.

### Synkronisering lokalt → globalt

Når metadata oppdateres lokalt etter publisering (ny beskrivelse, endret copyright), bør endringene kunne pushes til Global. Dette krever:
- En publiseringsstatus per bilde i lokal DB (`published_at`, `global_id`)
- En push-mekanisme (API-kall fra lokal til Global ved eksplisitt brukerhandling)
- Global behandler lokalt som autoritativ kilde for publisert innhold

### Identitet og autentisering

Lokal Hotprevue har ingen autentisering. Global trenger det. Løsning: API-nøkkel generert av Global og lagret lokalt. Publisering er en eksplisitt handling som krever nøkkelen. Author-profilen (navn, kontaktinfo, lenke) opprettes én gang i Global og knyttes til nøkkelen.

### Tilgang til original

Originalen er på fotografens maskin og er ikke en del av Global. Kontaktmekanismen i Global (e-post eller skjema til fotografen) er tilstrekkelig for MVP. Fotografen avgjør selv om og hvordan originalen deles — utenfor systemet.

### Kryss-fotograf-samlinger

I Global kan bilder fra ulike fotografer grupperes i en tematisk collection av en kurator. Støyle-samlingen kan inneholde bidrag fra alle som har fotografert i Gloppen, uavhengig av hvilken lokal instans bildene kom fra. Dette er en mulighet ingen eksisterende verktøy tilbyr i denne formen.

### Federering som langsiktig retning

I stedet for én sentral Global-server kan arkitekturen på sikt bygge på et federert modell inspirert av ActivityPub (brukt av Mastodon, Pixelfed). Uavhengige Global-noder kommuniserer med hverandre. Dette eliminerer enkeltpunktsfeil og ansvarsproblemet. Bør ikke bygges i første versjon, men arkitekturen bør ikke aktivt motarbeide det.

### IPTC-kompatibilitet

IPTC er bransjestandardformatet for fotometadata (copyright, author, beskrivelse, nøkkelord) — brukt av pressebyråer, museer og arkiver. Hvis Hotprevue lagrer og eksporterer IPTC-kompatible felt, er systemet interoperabelt med et bredere profesjonelt økosystem.

### Kjente risikoer

- **Kald-start-problem:** Oppdagelsesplattformer er verdiløse uten innhold. Støyle-prosjektet og egne publiseringsprosjekter gir verdi fra dag én uavhengig av andre brukere — det er en god startposisjon.
- **Moderering:** Selv uten originallagring er man plattformeier for publisert innhold. GDPR og opphavsrett må planlegges for.
- **hothash-stabilitet:** Dekkes av publiseringslåsing beskrevet over.

### Prioritering

Global bygges ikke før lokal Hotprevue er ferdig og validert. Lokal har full verdi i seg selv.

---

## Installer og distribusjon

Hotprevue bør på sikt tilbys som en installer slik at andre brukere kan deploye det på egen maskin eller hjemmeserver — uten teknisk kompetanse som forutsetning. Modell: ligner på Immich, Nextcloud eller Home Assistant sin installasjonsopplevelse.

## Flere installasjoner, ett sett bilder

Scenario: bærbar brukes til registrering ute, hjemmelab er master. Synkronisering av database og coldpreview mellom maskiner er allerede tenkt på, men et mer automatisert oppsett (f.eks. Syncthing-integrasjon eller replikeringsprotokoll) kan gjøre dette sømløst.

## Perceptuell likhet og duplikatdeteksjon

Hothash håndterer eksakte duplikater. Perceptual hashing (f.eks. pHash) kan brukes til å finne nesten-duplikater — bilder av samme motiv med liten variasjon. Dette er grunnlaget for automatiske stack-forslag.

## Automatisk organisering

Systemet kan foreslå events basert på tidsluker mellom bilder, eller stacks basert på motivlikhet. Forslagene er aldri automatisk gjennomført — brukeren godkjenner alltid.

## AI-assistert kategorisering og beskrivelse

Automatisk kategorisering og beskrivelse via bildegjenkjenning. Nyttig for store arkiver. Resultatene er forslag — brukeren korrigerer.

## Tidslinje og kart

Visualisering av bildesamlingen over tid (tidslinje) og geografi (kart basert på GPS-koordinater i EXIF). Gir oversikt over en hel livshistorie i bilder.
