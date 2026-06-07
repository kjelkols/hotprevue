# ADR-032: Nettverksarkitektur uten Tailscale

**Status:** Under vurdering  
**Dato:** 2026-06-06

## Kontekst

Hotprevue bruker i dag Tailscale for å gi klienter sikker tilgang til
backend-serveren over internett. Tailscale løser problemet med at
hjemmeservere sjelden har offentlig IP eller åpne porter, og at trafikken
må krypteres.

Målet er å distribuere Hotprevue til nye brukere uten at de trenger å
installere og konfigurere Tailscale. Avhengigheten av et eksternt selskap
(Tailscale Inc.) er også uønsket på sikt.

Hotprevue er ikke et P2P-system i egentlig forstand — problemet er
enklere: **klienten (browser/Python) trenger sikker tilgang til backenden**.

## Analyserte alternativer

### 1. Reverse tunnel / outbound proxy

Backenden knytter selv en utadgående tilkobling til en relay-server.
Klienter kobler til relay-serveren. Relay videreformidler trafikken, men
kan ikke lese den (TLS end-to-end).

Aktuelle verktøy:
- **rathole** — lett Rust-binær (~2 MB), kan bundles i distribusjonen
- **frp** — mer moden, støtter HTTPS-terminering, Go-binær
- **Cloudflare Tunnel** — gratis for privatbruk, men avhengig av Cloudflare

```
[Backend] --outbound TLS--> [Hotprevue relay] <-- [Klient/nettleser]
```

Fordeler: ingen portvideresending, fungerer bak streng NAT, kan bundles.  
Ulemper: Hotprevue-prosjektet må drifte en relay-server.

### 2. Nebula (Slacks mesh-VPN)

Fullt selvhostet mesh-VPN bygget på WireGuard-protokollen. Krever en
"lighthouse"-server kun for discovery — selve trafikken går direkte
mellom noder (NAT hole-punching).

Hvert node får et sertifikat signert av en CA du kontrollerer.
Binæren kan bundles i distribusjonen.

Fordeler: ingen sentral avhengighet, trafikk går direkte.  
Ulemper: brukeren må gjennom en sertifikat-oppsettsprosess; ikke
brukervennlig nok uten et dedikert administrasjonsverktøy.

### 3. Headscale (selvhostet Tailscale-kontrollplan)

Tailscale-klienter kan peke mot en selvhostet kontrollserver i stedet
for Tailscale Inc. Fjerner avhengigheten av selskapet, men brukeren
må fortsatt installere Tailscale-klienten.

### 4. mTLS + dynamisk DNS

Backend genererer et nøkkelpar ved første oppstart. En liten
Hotprevue-tjeneste tilbyr:
- **Dynamisk DNS:** backenden registrerer sin IP periodisk og får et
  stabilt hostnavn (f.eks. `abc123.hotprevue.no`)
- **mTLS:** klienten autentiseres med et klientsertifikat; backenden
  verifiserer det

```
backend.hotprevue.no  -->  HTTPS (mTLS)  -->  Backend-node
```

Selvbekreftende identitet à la Syncthing: backend genererer et nøkkelpar
ved første oppstart; "server-ID" = hash av offentlig nøkkel, brukes for
å parre klienter uten sentral brukerregistrering.

### 5. libp2p

Brukt av IPFS og Ethereum. Full P2P med DHT-basert discovery,
NAT-traversal, kryptert transport. Mest fleksibelt, men mest komplekst
å integrere i Python/FastAPI.

## Beslutning (tentativ)

**Fase 1:** Rathole eller frp bundlet i server-distribusjonen, med en
Hotprevue-hostet relay. Backenden kobler automatisk til relay ved oppstart
og får et stabilt hostnavn. Klienter bruker dette hostnavnet — ingen
portvideresending, ingen Tailscale.

**Fase 2:** Åpne relay-koden slik at avanserte brukere kan hoste sin
egen relay, eller koble direkte via eget domene/DDNS.

Selvbekreftende identitet (nøkkelpar ved første oppstart, server-ID som
parringsnøkkel) er et prinsipp som bør tas med uansett løsning — det
eliminerer behovet for sentral brukerregistrering.

## Konsekvenser

- Tailscale-avhengigheten fjernes fra sluttbrukerdistribusjonen
- Hotprevue-prosjektet må drifte en liten relay-tjeneste (fase 1)
- Eksisterende installasjoner med Tailscale fortsetter å fungere uendret
- Nettverksoppsett flyttes fra brukerens ansvar til distribusjonens ansvar
