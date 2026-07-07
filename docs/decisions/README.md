# Arkitekturbeslutninger (ADR)

Denne katalogen inneholder Architecture Decision Records (ADR) — korte dokumenter som forklarer *hvorfor* viktige beslutninger ble tatt.

## Formål

ADR-er gir kontekst til fremtidige utviklere (og AI-agenter) om hva som ble vurdert og valgt bort. De hindrer at samme diskusjoner tas om igjen, og gjør det lettere å vurdere om en beslutning bør revurderes.

## Format

Hver ADR er en egen fil: `NNN-kort-tittel.md`

```markdown
# NNN — Tittel

## Status
Planlagt | Godkjent | Implementert | Avvist | Erstattet av ADR-NNN

## Kontekst
Hva var situasjonen og hva var problemet som måtte løses?

## Beslutning
Hva ble valgt?

## Begrunnelse
Hvorfor ble dette valgt fremfor alternativene?

## Konsekvenser
Hva innebærer denne beslutningen fremover?
```

Statusfeltet i selve ADR-filen er fasit — hold tabellen under synkronisert når status endres.

## Eksisterende ADR-er

| Nr | Tittel | Status |
|---|---|---|
| 001 | Hothash som unik bilde-ID | Godkjent |
| 002 | Backend leser originalfiler direkte | Erstattet av ADR-008 |
| 003 | Lokal backend som systemproxy | Erstattet av ADR-008 |
| 004 | Perceptuell hashing | Godkjent |
| 005 | Source/target-navigasjon | Erstattet av ADR-014 |
| 006 | Tidslinje-arkitektur | Godkjent |
| 007 | Tkinter-installer og generert startskript | Godkjent |
| 008 | Klient-server-arkitektur: klienten prosesserer filer, backend lagrer | Godkjent |
| 009 | Databasekonfigurasjon: lokal eller ekstern PostgreSQL | Godkjent |
| 010 | Låsemekanisme for flermaskinsbruk | Godkjent |
| 011 | Maskin-fotograf-kobling og maskin-felt på photo | Godkjent |
| 012 | Identitetsvalg i nett-sesjon | Godkjent |
| 013 | Migrasjon fra lokal til sentral database | Godkjent |
| 014 | Bildekategorisering via picker-modaler | Godkjent |
| 015 | Arkitektur for katalogbrowsing og filflytting | Implementert (Alt. A + PinButton; Alt. C planlagt) |
| 016 | Bilderotasjon via EXIF og XMP sidecar (Lokale verktøy) | Implementert |
| 017 | Sporing av originalfilers lagringssted | Planlagt |
| 018 | Filutforsker for finjustering | Planlagt |
| 019 | Håndtering av rotasjon ved registrering | Planlagt |
| 020 | XMP sidecar ved registrering | Planlagt |
| 021 | Teknisk bildekvalitet ved registrering | Implementert |
| 022 | AI-analyselag | Planlagt |
| 023 | Søkarkitektur | Delvis implementert |
| 024 | Registreringsflyt v2 (klientdrevet) | Implementert |
| 025 | QuickView — tettgrid for store bildesett | Forslag |
| 026 | Søkeside-redesign med splittet layout | Implementert |
| 027 | UI-utseende — temabytte og tekststørrelse | Utkast |
| 028 | Visningskorreksjoner (PhotoCorrection) | Implementert |
| 029 | UI for visningskorreksjoner | Implementert |
| 030 | Nedlasting og deling | Erstattet av ADR-045 |
| 031 | Mobilstøtte | Delvis implementert |
| 032 | Nettverksarkitektur uten Tailscale (frp) | Godkjent |
| 033 | Zoom-tidslinje — semantisk zoom over bildesamlingen | Implementert |
| 034 | Kind — faglig og administrativ klassifikasjon | Implementert |
| 035 | Tags som entitetsmodell med forvaltnings-UI | Implementert |
| 036 | Stack-implementering | Implementert |
| 037 | EXIF-felter og lokasjonsbasert søk | Implementert |
| 038 | Deling av collections via token-lenker | Erstattet av ADR-045 |
| 039 | Offentlige lenker for enkeltbilder | Erstattet av ADR-045 |
| 040 | Maskinidentitet via invitasjonskode og API-token | Implementert |
| 041 | Gjestnode — telefon som registreringsklient (PWA) | Planlagt |
| 042 | Fotograf som brukeridentitet og flerbruker-tilgangskontroll | Erstattet av ADR-044 |
| 043 | Tid- og posisjonskorreksjon med provenans | Implementert |
| 044 | Fotograf som identitet og tilgangskontroll | Delvis implementert |
| 045 | Deling og leveranse | Implementert (Del 1–3 og 5; Del 4 planlagt) |
