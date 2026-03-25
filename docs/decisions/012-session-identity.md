# 012 — Identitetsvalg i nett-sesjon

## Status

Implementert (2026-03-25)

## Kontekst

Med klient-server-splitten (ADR-008) kan brukeren åpne backend-URL direkte i nettleser
uten en tilhørende Python-klient. En slik sesjon har ingen maskin-identitet og dermed
ingen automatisk fotograf-tilknytning.

Systemet er single-user og har ingen autentisering (se ADR-009 for sikkerhetsmodell).
Det trengtes likevel en mekanisme for å attribuere metadata (collections, ratings, tags)
til riktig person.

## Beslutning

### Identitetsvalg, ikke autentisering

Sesjons-identitet er et valg, ikke en innlogging. Spørsmålet systemet stiller er
"hvem skal ha æren for denne endringen?" — ikke "har du lov til å gjøre dette?".

### Skriving blokkeres uten valgt fotograf

Operasjoner som endrer eller oppretter metadata krever at en fotograf er valgt:
- Endre rating, tags, kategori på bilder
- Opprette eller redigere collections
- Alle andre skriveoperasjoner

Leseoperasjoner er alltid tillatt uten valgt identitet.

### Fotografvalg i UI

Ved oppstart:
- Er det nøyaktig én fotograf i databasen → velges automatisk, ingen spørsmål
- Er det flere fotografer → bruker velger fra liste ("Hvem er du?")
- Er det ingen fotografer → skriving blokkeres inntil minst én fotograf er opprettet

Valget lagres i nettleseren (localStorage) og huskes til neste gang.

### Sikkerhet delegeres til nettverkslaget

Applikasjonen implementerer ingen tilgangskontroll. Sikkerhet for VPS-installasjon
ivaretas av nettverkslaget (Tailscale anbefales, alternativt nginx med HTTP Basic Auth).
Se ADR-009.

## Begrunnelse

- Passordløst design er konsistent med single-user-filosofien
- Identitetsvalg er tilstrekkelig for attribuering i et personlig system
- Nettverkslaget er bedre egnet til autentisering enn applikasjonslaget
- Auto-valg ved én fotograf gir friksjonsfri opplevelse for enkeltbrukere

## Konsekvenser

- Frontend-state trenger `selected_photographer_id` (Zustand)
- API-kall som krever fotograf sender `photographer_id` i request body
- Backend validerer ikke fotograf-tilknytning — det er UI-laget sitt ansvar
- Brukere som ignorerer valget kan ikke opprette collections eller endre metadata
