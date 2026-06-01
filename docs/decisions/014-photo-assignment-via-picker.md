# 014 — Bildekategorisering via picker-modaler

## Status

Godkjent. Erstatter ADR-005.

## Kontekst

ADR-005 innførte et kilde/mål-system der brukeren satte en kilde (navigasjonsbokmerke) og et mål (destinasjon for batch-operasjoner) som global tilstand. Målet bestemte hvilke handlingsknapper SelectionTray viste.

I praksis skapte dette unødvendig kompleksitet:

- Brukeren måtte utføre to separate navigasjonshandlinger (sett kilde, sett mål) før selve arbeidet kunne starte
- Global mål-tilstand var forvirrende — det var ikke åpenbart at SelectionTray var inaktiv fordi inget mål var satt
- "Sett som mål"-knapper på event- og samlingsider krevde at brukeren forstod sammenhengen mellom sider

Filosofien er enkelhet. Kjente bildeprogrammer (Apple Photos, Google Photos) løser dette med en direkte modell: velg bilder → velg destinasjon i øyeblikket du handler.

## Beslutning

Global mål-tilstand fjernes. Bildekategorisering skjer via picker-modaler utløst fra:

1. Høyreklikk innenfor utvalg → batch-kontekstmeny → "Sett event…" / "Legg til i samling…" / "Legg til tag…"
2. SelectionTray → "Legg til i…"-knapp → velg type → picker-modal

Destinasjonen velges alltid i øyeblikket handlingen utføres.

## Konsekvenser

- `useNavigationStore` fjernes
- `SourceTargetPanel`-komponenten fjernes
- `SelectionTray` mister avhengighet til NavigationStore
- "Sett som kilde"- og "Sett som mål"-knapper fjernes fra alle sider
- Batch-kontekstmeny implementeres (planlagt i `context-menu.md`, men ikke ferdigstilt)
- Tre nye picker-modaler bygges: Event, Samling, Tag
