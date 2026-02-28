# 003 — Lokal backend som systemproxy

## Status

Godkjent

## Kontekst

Hotprevue er en lokal applikasjon der brukeren jobber med sine egne bildefiler.
Brukergrensesnittet er en nettleser-app (React). Nettlesere har av sikkerhetsgrunner
ingen tilgang til filsystemet, native OS-dialoger eller andre systemressurser.

Det trengtes en løsning for å la nettleser-UI-et gjøre operasjoner som:

- Bla i katalogstrukturen for å velge bildekilder
- Åpne native katalogvelger-dialog
- Lese og prosessere bildefiler
- Hente maskininformasjon

## Beslutning

Den lokale Python-backenden fungerer som **systemproxy**: den kjører som en vanlig
OS-prosess med full tilgang til filsystemet, og eksponerer denne tilgangen via
HTTP-endepunkter til nettleser-UI-et.

```
Nettleser (React)          Python-prosess (backend)
      │                           │
      │  GET /system/browse       │
      │ ─────────────────────→   │  os.scandir("/mnt/c/Bilder")
      │                          │  ← leser direkte fra disk
      │  { dirs, files }          │
      │ ←─────────────────────   │
```

Backenden er ikke en server på internett — den er et lokalt program som tilfeldigvis
kommuniserer via HTTP. Filsystemtilgang er like naturlig her som i et hvilket som helst
annet program skrevet i Python.

## System-API-endepunkter

Disse endepunktene finnes utelukkende fordi nettleseren ikke kan gjøre operasjonene selv:

| Endepunkt | Hva backenden gjør |
|---|---|
| `GET /system/browse?path=...` | `Path.iterdir()` + filtrering |
| `POST /system/scan-directory` | Rekursiv `os.scandir()` |
| `POST /system/pick-directory` | Åpner tkinter-dialog |
| `POST /input-sessions/{id}/groups-by-path` | Leser bildefil, genererer previews |

## Begrunnelse

- **Backenden kjører allerede lokalt** — ingen ekstra prosess, ingen IPC-kompleksitet
- **Python har full OS-tilgang** — filsystem, subprosesser, native biblioteker
- **Enklere enn alternativer:** et Electron-shell eller en native app ville krevd et eget
  teknologilag kun for denne tilgangen
- **Skalerbar:** samme mønster brukes for fremtidige systemoperasjoner (åpne i
  filutforsker, overvåke kataloger, o.l.)

## Konsekvenser

- Backend og originalfiler **må** ligge på samme maskin
- Alle filoperasjoner i frontend **skal** gå via `/system`-endepunkter — aldri direkte
  fillesing i nettleseren
- Tkinter-dialogen krever et grafisk miljø (fungerer i Windows-distribusjon, ikke i
  headless WSL)
- Fremtidige systemoperasjoner legges naturlig til `api/system.py`
