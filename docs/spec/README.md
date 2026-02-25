# Kravspesifikasjon

Denne katalogen inneholder den autoritative kravspesifikasjonen for Hotprevue. Filene her beskriver hva systemet skal gjøre og hvordan — ikke implementasjonsdetaljer.

## Filer

| Fil | Innhold |
|---|---|
| `overview.md` | Systemets formål, brukere, ikke-mål og overordnede prinsipper |
| `domain.md` | Domenebegreper og definisjoner — én kilde til sannhet for terminologi |
| `data-model.md` | Datamodell, entiteter og relasjoner |
| `api.md` | API-kontrakter, konvensjoner og endepunktoversikt (menneskelig lesbar) |
| `previews.md` | Hotpreview og coldpreview — generering, lagring og synkronisering |
| `file-handling.md` | Originalfiler, ImageFiles, filstivalidering og synkstrategi |
| `frontend.md` | Ruter, visninger og UX-krav |

## Bruk

- Les `overview.md` og `domain.md` først — de legger grunnlaget for alt annet.
- Ved tvil om terminologi: `domain.md` har fasit.
- Teknisk API-dokumentasjon genereres automatisk fra kjørende backend (`scripts/export-api-docs.sh`). `api.md` beskriver designintensjon og konvensjoner, ikke detaljerte request/response-skjemaer.
