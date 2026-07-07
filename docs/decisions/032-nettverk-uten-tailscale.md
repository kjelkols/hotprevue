# ADR-032: Nettverksarkitektur uten Tailscale

**Status:** Godkjent
**Dato:** 2026-06-06
**Oppdatert:** 2026-07-06 — beslutning tatt: frp som tunneltransport.
rathole eliminert (dødt prosjekt), Pangolin evaluert og valgt bort
(auth-overlapp med ADR-040).

## Kontekst

Hotprevue bruker i dag Tailscale for å gi klienter sikker tilgang til
backend-serveren over internett. Tailscale løser problemet med at
hjemmeservere sjelden har offentlig IP eller åpne porter, og at trafikken
må krypteres.

Målet er å distribuere Hotprevue til nye brukere uten at de trenger å
installere og konfigurere Tailscale. Avhengigheten av et eksternt selskap
(Tailscale Inc.) er også uønsket på sikt.

Hotprevue er ikke et P2P-system — alle klienter (browser, uploader,
gjest-PWA) snakker HTTPS mot samme backend. Problemet er 1-til-N med
backend som fast punkt, ikke N-til-N. Riktig kategori er derfor
**utgående reverse tunnel**: backend kobler selv ut til en relay ved
oppstart og får en stabil offentlig HTTPS-adresse. Ingen portåpning,
fungerer bak enhver NAT/CGNAT.

En viktig avgrensning: tunnelen berører kun backend-distribusjonen og
relay-infrastrukturen. Browser trenger ingen installer-komponent (den
*er* en URL), og uploaderen trenger bare backend-URL + maskintoken fra
enrollment (ADR-040/044).

## Analyserte alternativer

### rathole — eliminert

Lett Rust-binær, i sin tid hovedkandidat sammen med frp. Siste release
(v0.5.0) er fra oktober 2023; prosjektet ble flyttet til en community-org
etter at originalforfatteren forsvant, uten releaser siden. En komponent
som bærer all trafikk inn til arkivet kan ikke stå på et i praksis dødt
prosjekt.

### Pangolin (fosrl) — evaluert og valgt bort

Selvhostet «identity-aware» tunnelplattform: Docker-stack på VPS
(Pangolin-kontrollplan, Gerbil/WireGuard, Traefik med automatisk TLS),
enkelt-binær «Newt» på backend-siden. Svært aktivt vedlikeholdt
(YC-selskapet Fossorial), dual-lisens AGPL-3/kommersiell, Integration API
for provisjonering.

Valgt bort fordi verdiforslaget — identitetsbevisst tilgangskontroll per
ressurs (SSO, passord, PIN) — **overlapper Hotprevues egen auth-modell**
(maskintoken og invitasjonskoder, ADR-040/044). Betaler man
kompleksitetskostnaden (Docker-stack, eget brukerregister,
AGPL-vurdering) og skrur av tilgangslaget, sitter man igjen med
Traefik + WireGuard — en tyngre frp. Pangolin er riktig for prosjekter
uten egen auth; Hotprevue har allerede bygget sin.

**Revurderingspunkt:** hvis provisjonerings- og sertifikatskriptingen
rundt frp vokser seg vesentlig større enn antatt, kjøper Pangolin nettopp
det stykket ferdig.

### Cloudflare Tunnel — valgt bort

Gratis og null drift, men domenet må ligge hos Cloudflare, TLS termineres
i Cloudflares nett, og tilgjengeligheten avhenger av en tredjepart —
samme innvending som mot Tailscale.

### Mesh-VPN (Nebula, Headscale, NetBird, libp2p) — valgt bort

Løser et N-til-N-problem Hotprevue ikke har, og krever klientinstallasjon
og/eller sertifikatoppsett hos brukeren.

### Ren WireGuard + nginx-vhost — valgt bort som hovedspor

Null ny programvare for dagens éngbruker-situasjon, men hver ny bruker
krever manuelt nøkkel- og vhost-oppsett på relayen. Skalerer ikke til
distribusjonsmålet.

## Beslutning

**frp** (fatedier/frp, Apache 2.0) som tunneltransport, med
TLS-terminering i eksisterende nginx (eventuelt Caddy) på relay-serveren.

frp er valgt fordi den er nøyaktig komponenten som mangler og ikke mer:
dum, kryptert transport uten meninger om identitet. Én statisk Go-binær i
hver ende, token-autentisert utgående tilkobling, innebygd
subdomene-vhost, aktivt vedlikeholdt med stort miljø (v0.69.1, juni 2026,
~100k stjerner). ADR-040-tokens forblir eneste auth-lag i systemet.

### Arkitektur

```
                        *.hp.<domene>  (wildcard-DNS → relay)
                                │
                        ┌───────▼────────┐
   https://abc.hp.<domene>   nginx (TLS) │   relay-server (Trollfjell)
                        │       │        │
                        │     frps       │
                        └───────▲────────┘
                                │ utgående TLS-tunnel (token)
                        ┌───────┴────────┐
                        │     frpc       │   brukerens backend-maskin
                        │  backend :8000 │
                        └────────────────┘
```

### Relay-serveren (Trollfjell)

- `frps` som systemd-tjeneste bak nginx, gjenbruker mønsteret fra
  eksisterende `relay/` (ADR-045 del 5).
- Wildcard-DNS `*.hp.<domene>` peker på relayen.
- Sertifikater: ett wildcard-sertifikat via certbot DNS-01
  (Domeneshop har certbot-plugin), alternativt Caddy med on-demand TLS
  foran frps hvis per-subdomene-utstedelse blir enklere.
- Hver Hotprevue-instans identifiseres av (subdomene, frp-token).
  For nåværende éngbruker-situasjon er dette én statisk
  konfigurasjonsblokk; ved distribusjon utvides relay-tjenesten med et
  provisjoneringsendepunkt som utsteder subdomene + token.

### Backend-distribusjonen

- `frpc`-binæren bundles i zip-pakken (samme mønster som `uv`).
- Installeren skriver `frpc.toml` fra to verdier: relay-adresse og
  instans-token. Startskriptet starter frpc sammen med uvicorn når
  `HOTPREVUE_TUNNEL=on`.
- Backend får dermed en stabil `https://<instans>.hp.<domene>` uten
  portåpning hos brukeren.

### Browser og uploader

- **Browser:** ingen tunnelkomponent — bruker den offentlige URL-en
  direkte.
- **Uploader:** installeren spør om backend-URL + invitasjonskode,
  enrollerer (ADR-040) og lagrer maskintokenet. Ingen tunnelkomponent.
- **Gjest-PWA (ADR-041):** som browser — trenger bare URL-en.

### Forutsetning: obligatorisk autentisering

Tunnelen gjør backend offentlig tilgjengelig. Før en instans eksponeres
må auth-håndhevingen snus fra «åpen med unntak» til «lukket med unntak»:
alle endepunkter — også lesing og coldpreview-serving — må kreve gyldig
maskintoken (jf. ADR-044). Dagens `require_owner`-unntak for
uautentiserte kall («legacy owner machines») forutsetter Tailscale som
tillitsgrense og kan ikke bestå bak tunnelen.

## Begrunnelse

- **Passer eksisterende drift:** relay-siden gjenbruker nginx + certbot +
  systemd-mønsteret som allerede kjører på Trollfjell.
- **Ingen auth-duplisering:** frp er ren transport; Hotprevues egen
  identitetsmodell (ADR-040/044) forblir eneste tilgangskontroll.
- **Installer-vennlig:** én statisk binær og en generert TOML-fil per
  ende — samme bundlingsmønster som distribusjonen bruker i dag.
- **Skalerer til distribusjon:** nye brukere = nytt (subdomene, token)
  på relayen, skriptbart uten manuell vhost-konfigurasjon.
- **Modenhet:** frp er det klart mest brukte og aktivt vedlikeholdte
  verktøyet i kategorien.

## Konsekvenser

- Tailscale-avhengigheten fjernes fra sluttbrukerdistribusjonen.
  Eksisterende Tailscale-oppsett fortsetter å fungere uendret.
- Hotprevue-prosjektet drifter relayen (frps + nginx). Liten flate:
  to systemd-tjenester og en DNS-sone.
- **Tillitsforbehold:** relayen terminerer TLS og kan teknisk sett lese
  trafikken. Akseptabelt så lenge eieren drifter relayen selv; for
  distribusjon beholdes fase 2 som exit: åpen relay-oppskrift slik at
  brukere kan hoste egen relay eller bruke eget domene/DDNS.
- Migrering av eksisterende Tailscale-baserte owner-maskiner til
  token-modellen må avklares (åpent spørsmål fra ADR-040, jf.
  `docs/vision/tilgang-og-deling.md`).
- Invitasjonsdeling (deep link / QR mot `https://<instans>.hp.<domene>`)
  får det stabile vertsnavnet den forutsetter.

## Åpne spørsmål

1. Wildcard-sertifikat (DNS-01) vs. Caddy on-demand TLS — avgjøres ved
   implementasjon av relay-oppsettet.
2. Provisjoneringsendepunktets form (utvidelse av `relay/relay.py` eller
   egen liten tjeneste) — trengs først ved distribusjon til andre.
3. Forholdet mellom denne relayen og delings-relayen (ADR-045 del 5):
   samme server, men bør de forbli separate tjenester?
