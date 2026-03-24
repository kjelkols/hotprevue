# Arkitekturbeslutninger (ADR)

Denne katalogen inneholder Architecture Decision Records (ADR) — korte dokumenter som forklarer *hvorfor* viktige beslutninger ble tatt.

## Formål

ADR-er gir kontekst til fremtidige utviklere (og AI-agenter) om hva som ble vurdert og valgt bort. De hindrer at samme diskusjoner tas om igjen, og gjør det lettere å vurdere om en beslutning bør revurderes.

## Format

Hver ADR er en egen fil: `NNN-kort-tittel.md`

```markdown
# NNN — Tittel

## Status
Godkjent | Avvist | Erstattet av ADR-NNN

## Kontekst
Hva var situasjonen og hva var problemet som måtte løses?

## Beslutning
Hva ble valgt?

## Begrunnelse
Hvorfor ble dette valgt fremfor alternativene?

## Konsekvenser
Hva innebærer denne beslutningen fremover?
```

## Eksisterende ADR-er

| Nr | Tittel | Status |
|---|---|---|
| 001 | Hothash som unik bilde-ID | Godkjent |
| 002 | Backend leser originalfiler direkte | Erstattet av ADR-008 |
| 003 | Lokal backend som systemproxy | Erstattet av ADR-008 |
| 004 | Perceptuell hashing | Godkjent |
| 005 | Source/target-navigasjon | Godkjent |
| 006 | Tidslinje-arkitektur | Godkjent |
| 007 | Tkinter-installer og generert startskript | Godkjent |
| 008 | Klient-server-arkitektur: klienten prosesserer filer, backend lagrer | Godkjent |
| 009 | Databasekonfigurasjon: lokal eller ekstern PostgreSQL | Godkjent |
| 010 | Låsemekanisme for flermaskinsbruk | Godkjent |
