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
