# Dokumentasjon — Hotprevue

Denne katalogen inneholder all prosjektdokumentasjon, organisert etter formål.

## Struktur

| Katalog / fil | Rolle |
|---|---|
| `spec/` | Kravspesifikasjon — autoritativ kilde for hva systemet skal gjøre og hvordan |
| `decisions/` | Arkitekturbeslutninger (ADR) — hvorfor ting ble som de ble |
| `vision/` | Strategisk tenkning — overordnede ideer og retning, ikke krav |
| `TODO.md` | Aktiv oppgaveliste, prioritert etter neste steg |
| `CHANGELOG.md` | Kronologisk logg over endringer |

## Prinsipper

- **`spec/`** er autoritativ. Kode skal reflektere spec, ikke omvendt.
- **`decisions/`** forklarer kontekst og begrunnelse — les disse før du endrer etablerte mønstre.
- **`vision/`** er ikke krav. Dokumentene der brukes som strategisk kompass ved diskusjon om nye funksjoner, ikke som handlingsliste.
- **`TODO.md`** er levende og oppdateres kontinuerlig. Gjennomgås ved hver arbeidsøkt.
- **`CHANGELOG.md`** oppdateres hver gang noe av betydning endres i kodebasen.

## Eldre dokumenter

`agent-instructions.md` er et tidlig utkast fra oppstartsfasen. Innholdet er gradvis migrert til `spec/` og `decisions/`. Filen beholdes inntil migreringen er fullført.
