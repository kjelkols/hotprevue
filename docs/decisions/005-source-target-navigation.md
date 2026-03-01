# 005 — Kilde/mål-navigasjon

## Kontekst

Arbeidsflyt i Hotprevue innebærer ofte å hente bilder fra flere steder (sesjoner, events) og samle dem i ett mål (kolleksjon eller event). Behovet er:

- Rask navigasjon mellom aktive visninger uten å miste kontekst
- Tydelig oversikt over hva som er aktivt mål
- Separasjon mellom *navigasjon* og *bildeutvalg* (selection)

## Beslutning

Vi innfører et **kilde/mål-system** som et rent navigasjonshjelpemiddel, adskilt fra selection.

### Begreper

| Begrep | Beskrivelse |
|---|---|
| **Kilde** | Bokmerke til en view man henter bilder fra. Kun for navigasjon — påvirker ikke selection. |
| **Mål** | Angir hvor valgte bilder skal plasseres. Bestemmer hvilken handling SelectionTray tilbyr. |
| **Selection** | Globalt sett med valgte bilder (hothashes). Uavhengig av kilde/mål. |

### Tillatte kombinasjoner

| Type | Kilde | Mål |
|---|---|---|
| Sesjon | ✓ | — |
| Event | ✓ | ✓ |
| Kolleksjon | — | ✓ |

En ting kan ikke være både kilde og mål. Dette sperres i UI.

### Mål-operasjoner

Typen mål bestemmer hvilken handling utføres når man trykker «Sett inn» i SelectionTray:

- **Kolleksjon**: Bilder legges til i kolleksjonen (`POST /collections/{id}/items/batch`)
- **Event**: `event_id` på de valgte bildene oppdateres (`POST /photos/batch/event`). Bilder flyttes — one-to-many-relasjon, ett bilde tilhører maks ett event.
- *Fremtidige mål*: Tags, kategorier, o.l. implementeres etter behov.

### Panel

`SourceTargetPanel` vises under TopNav i AppLayout, men bare når minst én kilde eller ett mål er satt. Inneholder:
- Kilde-chips (klikkbare = navigasjon, × = fjern)
- Pil → mellom kilde og mål
- Mål-chip (amber-farge, klikkbar = navigasjon, × = fjern)
- Minimer-knapp (—): kollapser til tynn statuslinje
- Nullstill-knapp (×): fjerner alle kilder og mål

### State

Håndteres av `useNavigationStore` (Zustand, client-only, ingen persistering).

## Alternativer vurdert

- **Historikk-dropdown**: Viser nylig besøkte sider. Dekker ikke «hvilket mål er aktivt»-behovet like tydelig.
- **Kommandopalett (Cmd+K)**: Kraftigere, men unødvendig kompleksitet for dette enkeltbrukersystemet nå.
- **Sub-events**: Opprinnelig tenkt for å organisere innenfor et event. Erstattet av flat event-struktur + kilde/mål-navigasjon.
