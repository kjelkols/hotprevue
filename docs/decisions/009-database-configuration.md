# 009 — Databasekonfigurasjon: lokal eller ekstern PostgreSQL

## Status

Godkjent

## Kontekst

Med ADR-008 kan backend kjøre enten lokalt eller på en server. Databasen må
konfigureres tilsvarende. To bruksscenarier stiller ulike krav:

1. **Frittstående enkeltmaskin** — klient og backend på samme maskin, ingen nettverkskrav.
   pgserver (embedded PostgreSQL) er enklest: ingen separat databaseinstallasjon.
2. **Backend på server, en eller flere klienter** — databasen kjører på serveren.
   Klientene kobler seg til backend-API; backend kobler seg til PostgreSQL lokalt på serveren.

## Beslutning

Databasevalget gjøres i installasjonswizarden og lagres i konfigurasjonen til backenden.
Tre installasjonsscenarier:

### Scenario 1: Frittstående (lokal backend + lokal database)

```
HOTPREVUE_LOCAL=true
```

pgserver starter automatisk en embedded PostgreSQL. Ingen ekstra installasjon.
Anbefalt for enkeltmaskinbruk.

### Scenario 2: Backend på server med ekstern database

```
DATABASE_URL=postgres://bruker:passord@localhost:5432/hotprevue
```

Brukeren administrerer PostgreSQL selv på serveren. Backend-installasjon på serveren
konfigureres med connection string under oppsett.

### Scenario 3: Klient som kobler til eksisterende backend

Klienten trenger kun backend-URL:

```
HOTPREVUE_BACKEND_URL=http://192.168.1.100:8000
```

Ingen database-konfigurasjon på klienten — databasen styres av backend.

### Installasjonswizard

Setup-wizard presenterer disse valgene i klartekst:

```
Velg installasjonsmodus:

[1] Lokal installasjon (backend + database på denne maskinen)
    Anbefalt for enkel enkeltmaskinbruk.

[2] Serverinstallasjon (backend på denne maskinen, ekstern database)
    PostgreSQL connection string: ___________________

[3] Klientinstallasjon (koble til eksisterende backend på server)
    Backend-URL: ___________________
```

## Begrunnelse

- Scenario 1 bevarer den enkle opplevelsen for enkeltbrukere — ingen PostgreSQL-kompetanse nødvendig
- Eksisterende konfigurasjonsmønster (`HOTPREVUE_LOCAL`, `DATABASE_URL`) beholdes uendret
- Klienten i scenario 3 er stateless mht. database — lettere å sette opp og vedlikeholde

## Konsekvenser

- Installasjonswizarden (ADR-007) må oppdateres med disse tre scenariene
- `HOTPREVUE_BACKEND_URL` er ny miljøvariabel for klientmodus
- En klient i scenario 3 kjører bare den lokale Python-prosessen og React-UI — ingen database, ingen pgserver
