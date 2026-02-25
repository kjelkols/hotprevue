# Systemoversikt

## Formål

Hotprevue er et bildehåndteringssystem for fotografer med store bildesamlinger. Systemet indekserer og organiserer bilder uten å flytte, endre eller ta eierskap over originalfilene — kun metadata og forhåndsvisninger lagres.

## Brukere

Enkeltbruker. Ingen autentisering. Hver installasjon har én database og én bruker.

## Kjerneprinsipp

Originalfiler røres aldri. Systemet registrerer metadata og genererer forhåndsvisninger — det er alt. Brukeren bestemmer selv hvor og hvordan originalene lagres og organiseres.

## Ikke-mål

- Ingen filflytting, omdøping eller organisering av originalfiler
- Ingen flerbruker-støtte
- Ingen skylagring av originalfiler
- Ingen destruktive bildeoperasjoner

## Overordnet arkitektur

- **Backend:** FastAPI (Python), PostgreSQL, Alembic
- **Frontend:** Webapp (teknologivalg ikke låst)
- **Kommunikasjon:** HTTP API mellom frontend og backend
- **Tilgang:** Backend lytter på `0.0.0.0` — tilgjengelig via Tailscale og Docker

## Dataflyt

1. Bruker velger en katalog med originalbilder
2. Backend registrerer hvert bilde: trekker ut EXIF, genererer hotpreview og coldpreview, lagrer metadata og originalfilsti
3. Frontend bruker databasen og coldpreview-filer for visning
4. Originalfiler hentes kun når det er eksplisitt nødvendig (eksport, åpning i eksternt program)
