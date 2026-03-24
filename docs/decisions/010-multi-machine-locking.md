# 010 — Låsemekanisme for flermaskinsbruk

## Status

Godkjent

## Kontekst

Med ADR-008 og ADR-009 kan flere klientmaskiner dele samme backend og database.
Det oppstår da risiko for konflikt hvis to maskiner starter registrering eller
batch-redigering samtidig mot samme database.

Realistisk bruksmønster er ikke ekte simultanbruk — det er sekvensielt bruk fra
ulike maskiner (f.eks. registrerer fra bærbar på reise, redigerer fra stasjonær
hjemme). En tung transaksjonell låsemekanisme er unødvendig og frustrerende.

## Beslutning

En enkel advisory lock lagret i databasen. Locken er synlig for brukeren og kan
overtas manuelt. Den er ikke en teknisk sperring — den er en brukersynlig advarsel.

### Skjema

```sql
CREATE TABLE machine_locks (
    lock_type   TEXT PRIMARY KEY,   -- 'registration', 'batch_edit'
    locked_by   TEXT NOT NULL,      -- instance_name fra SystemSettings
    locked_at   TIMESTAMPTZ NOT NULL,
    expires_at  TIMESTAMPTZ NOT NULL  -- TTL: 30 minutter
);
```

### Endepunkter

| Metode | Endepunkt | Beskrivelse |
|---|---|---|
| `GET` | `/system/lock` | Sjekk nåværende lock-status |
| `POST` | `/system/lock` | Ta lock (returnerer 409 hvis allerede tatt) |
| `DELETE` | `/system/lock` | Frigi lock |

### Protokoll

1. Maskin A starter registrering → `POST /system/lock` med `lock_type: "registration"`
2. Backend setter lock med 30 min TTL og returnerer 200
3. Maskin B forsøker å starte registrering → `POST /system/lock` returnerer 409
4. Maskin B viser: *"Pågår registrering fra «Bærbar» siden 14:23. Vil du overta?"*
5. Maskin A fullfører → `DELETE /system/lock`
6. TTL på 30 min håndterer krasj og avbrudd — locken utløper automatisk

### Hvem tar lock

- Klienten tar lock ved oppstart av registreringssesjon
- Klienten tar lock ved batch-redigering som berører mange bilder
- Klienten frigir lock ved fullføring eller avbrudd
- Backend rydder automatisk opp i utløpte locks ved hver lock-forespørsel

## Begrunnelse

- Enkel å forstå og implementere
- Håndterer det realistiske scenariet (ubevisst simultanbruk) uten å stresse
  bevisste arbeidsflyter (en maskin om gangen)
- TTL forhindrer evig lock etter krasj
- Overtak-muligheten gir brukeren full kontroll

## Konsekvenser

- `machine_locks`-tabell legges til i databasemigrering
- Klienten må implementere lock-håndtering i registreringsflyt
- Lock er advisory — teknisk sett kan to maskiner skrive samtidig hvis bruker
  ignorerer advarselen. Dette er akseptert risiko for et personlig enkeltbrukersystem.
