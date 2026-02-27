# 002 — Frontend laster opp filer til backend

## Status

Revidert (opprinnelig: "Backend kjører der filene er")

## Kontekst

Opprinnelig beslutning antok at backend leser originalfiler direkte fra filsystemet. Ved implementering ble det klart at dette er et unødvendig krav: frontend (Electron) har lokal tilgang til filsystemet og kan laste opp filinnhold til backend via HTTP multipart.

Dette åpner for et enklere og mer fleksibelt oppsett: backend behøver ikke å kjøre på samme maskin som filene.

## Beslutning

Frontend scanner katalogen lokalt, leser filene og sender innholdet til backend én gruppe om gangen via `POST /input-sessions/{id}/groups` (multipart). Backend prosesserer mottatt filinnhold — backend leser aldri originalfiler direkte fra filsystemet.

`file_path` i databasen er stien slik frontend oppgir den — sett fra frontends filsystem, ikke fra backenden.

## Begrunnelse

- Frontend (Electron) har lokal aksess — det er naturlig at den leser filer og sender bytes
- Backend trenger ikke montering av nettverksdisk eller lokal tilgang til originaler
- Enklere deploymentmodell: backend kan kjøre i sky eller på hjemmeserver uavhengig av filplassering
- Sikrer at `source_path` og `file_path` alltid er konsistente fra frontends perspektiv

## Deploymentscenarier

**Desktop:** Docker Compose kjører backend og database på localhost. Frontend (Electron) kjører lokalt og laster opp filer fra lokalt filsystem til backend via HTTP.

**Hjemmeserver:** Backend kjører på serveren. Frontend kjøres fra hvilken som helst maskin med lokal tilgang til bildekatalogen — laster opp til backend over nett.

**Laptop i felt:** Backend kjøres på laptopen. Frontend laster opp lokale filer. Database og coldpreviews synkroniseres til hjemmeserveren etterpå (rsync eller tilsvarende).

## Konsekvenser

- `file_path` i databasen er stien sett fra frontend — kan bli ugyldig hvis filene flyttes eller frontends maskin byttes
- Backend trenger ikke å kjøre på samme maskin som originalfilene
- Registrering av store samlinger kan ta tid pga. nettverksoverføring, men dette er akseptabelt for engangsoperasjoner
- Reprocess (`POST /photos/{hothash}/reprocess`) krever at frontend sender ny masterfil — samme mønster som registrering
