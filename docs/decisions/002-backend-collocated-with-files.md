# 002 — Backend kjører der filene er

## Status

Godkjent

## Kontekst

Hotprevue skal kunne installeres på to måter: på en desktop-maskin (enkleste modell) og på en hjemmeserver. I begge tilfeller er spørsmålet: hvor kjører registreringslogikken, og hvordan forholder backend seg til originalfilene?

Registrering innebærer å lese bildefiler, generere hotpreview og coldpreview, og ekstrahere EXIF. Dette er operasjoner som krever direkte tilgang til filene. Alternativet — å sende råfiler over nett til en ekstern backend — er uaktuelt: en batch på 200 bilder kan utgjøre 1–2 GB, og RAW-filer alene er 25–50 MB per stykk.

Lignende systemer (Immich, PhotoPrism, Plex, Jellyfin) løser dette på samme måte: tung prosessering skjer alltid nær filene, og klienten er et rent display-lag.

## Beslutning

Backend kjører alltid på samme maskin som originalfilene er tilgjengelige fra. Frontend er et rent display- og interaksjonslag som aldri leser bildefiler direkte — all filbehandling skjer i backenden via API.

`file_path` i databasen er alltid en sti sett fra backenden, ikke fra klienten.

## Begrunnelse

- Råfiler sendes aldri over nett for prosessering — ingen båndbreddeflaskehals
- Samme arkitektur som etablerte systemer i samme kategori
- Enkel og forutsigbar grense mellom frontend og backend
- Fungerer naturlig for begge deploymentscenarier uten arkitekturendring

## Deploymentscenarier

**Desktop:** Docker Compose kjører alt på localhost. Filer, backend og frontend er på samme maskin. Ingen nettverkstrafikk for filbehandling.

**Hjemmeserver:** Backend kjører på serveren. Originaler er lagret på serveren eller montert via nettverksdisk (NFS/SMB). Frontend nås fra alle enheter på hjemmenettverket eller via Tailscale.

**Laptop i felt:** Backend kjøres på laptopen. Bilder registreres lokalt. Database og coldpreviews synkroniseres til hjemmeserveren etterpå (rsync eller tilsvarende). Originalfiler blir på laptopen/ekstern disk.

## Konsekvenser

- Registrering forutsetter at filene er tilgjengelige for backenden — dette må kommuniseres tydelig til brukeren
- Vil man registrere fra en ny maskin, må backenden kjøre der
- `file_path` er bare gyldig på maskinen der backenden kjører — ved synkronisering mellom maskiner kan stier bli ugyldige og må oppdateres
- Electron-støtte i frontend endrer ikke denne arkitekturen — Electron er et distribusjonsformat, ikke en ny komponent i dataflaten
