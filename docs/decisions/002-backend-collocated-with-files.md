# 002 — Backend leser originalfiler direkte

## Status

Gjeldende

## Kontekst

Det var to mulige tilnærminger for å gi backend tilgang til originalbilder:

1. **Frontend laster opp bytes** — frontend scanner katalog, leser filer og sender innhold til backend via HTTP multipart (`POST /input-sessions/{id}/groups`).
2. **Backend leser fra filsystem** — backend mottar en filsti og leser filen direkte fra disk.

Den første tilnærmingen ble implementert da Electron var planlagt distribusjonsformat (frontend hadde da lokal filsystemtilgang via Node.js). Da distribusjonen ble lagt om til zip-pakke med nettleser som UI, mistet frontend filsystemtilgang.

## Beslutning

Backend leser originalfiler direkte fra filsystemet via sti.

- `POST /system/pick-directory` — åpner native katalogvelger (tkinter), returnerer sti
- `POST /system/scan-directory` — backend scanner katalog og returnerer filgrupper
- `POST /input-sessions/{id}/groups-by-path` — backend mottar metadata med filsti og leser filen selv

`file_path` i databasen er stien sett fra backendmaskinens filsystem.

## Begrunnelse

- Backend og originalfiler kjører alltid på samme maskin (lokal installasjon)
- Eliminerer nettverksoverføring av store RAW-filer
- Enklere kode — ingen multipart-opplasting, ingen bytes gjennom frontend
- Tkinter-katalogvelger gir native OS-dialog uten nettlesertillatelser

## Konsekvenser

- Backend og originalfiler **må** ligge på samme maskin
- `file_path` kan bli ugyldig hvis filene flyttes — brukerens ansvar
- Nettleserbasert frontend (uten filsystemtilgang) er tilstrekkelig som UI
