# Dokumentasjon — Hotprevue

Denne katalogen inneholder all prosjektdokumentasjon, organisert etter formål.

## Struktur

| Katalog / fil | Rolle |
|---|---|
| `spec/` | Spesifikasjon — hva systemet gjør og hvordan |
| `decisions/` | Arkitekturbeslutninger (ADR) — hvorfor ting ble som de ble |
| `vision/` | Strategisk tenkning — overordnede ideer og retning, ikke krav |
| `drafts/` | Utkast og ideer som ikke er besluttet eller implementert |
| `deployment.md` | Topologi og driftsoppsett (dev og server) |
| `program-distribution.md` | Bygging av zip-distribusjoner |
| `workflow.md` | Arbeidsflyt |

## Prinsipper

- **Koden og ADR-ene er fasit.** `spec/` skal speile faktisk tilstand — ved avvik oppdateres spec-filen, koden «rettes» ikke tilbake til gammel spec.
- **`decisions/`** forklarer kontekst og begrunnelse — les relevante ADR-er før du endrer etablerte mønstre. Hver ADR har eget statusfelt; indeksen i `decisions/README.md` skal holdes à jour.
- **`vision/`** er ikke krav. Dokumentene der brukes som strategisk kompass ved diskusjon om nye funksjoner, ikke som handlingsliste.
- **Endringshistorikk** dokumenteres av git-loggen og ADR-ene. Egne `TODO.md`/`CHANGELOG.md`-filer er avviklet (juli 2026) — de forfalt raskere enn de ga verdi.

## Eldre dokumenter

`agent-instructions.md` er et tidlig utkast fra oppstartsfasen. Innholdet er gradvis migrert til `spec/` og `decisions/`. Filen beholdes inntil migreringen er fullført.
