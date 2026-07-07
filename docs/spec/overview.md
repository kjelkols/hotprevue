# Systemoversikt

## Formål

Hotprevue er et bildehåndteringssystem for fotografer med store bildesamlinger. Systemet indekserer og organiserer bilder uten å flytte, endre eller ta eierskap over originalfilene — kun metadata og forhåndsvisninger lagres.

## Brukere

Én eier med full tilgang, pluss eventuelle gjestefotografer med begrenset tilgang (ADR-044). Hver fotograf er en identitet i systemet (`photographers.access_level`: `owner` / `guest`). Maskiner autentiseres med API-token utstedt via invitasjonskode (ADR-040). Nettlesere uten token velger fotografidentitet fra en liste (ADR-012) — dette forutsetter i dag et beskyttet nett (Tailscale); se ADR-032 for veien mot eksponering uten Tailscale.

## Kjerneprinsipp

Originalfiler røres aldri. Systemet registrerer metadata og genererer forhåndsvisninger — det er alt. Brukeren bestemmer selv hvor og hvordan originalene lagres og organiseres.

## Ikke-mål

- Ingen filflytting eller omdøping av originalfiler i kjerneflyten («Lokale verktøy» er et eksplisitt unntak: frivillige, brukerstyrte filoperasjoner via agenten, se ADR-015/016)
- Ingen skylagring av originalfiler
- Ingen destruktive bildeoperasjoner — korreksjoner er visningslag (ADR-028)

## Komponenter

| Komponent | Rolle |
|---|---|
| **Backend** | FastAPI (Python, synkron), PostgreSQL, Alembic. Ren API-server: lagrer metadata, lagrer og serverer coldpreviews. Leser aldri originalfiler. Serverer også bygd frontend som statiske filer. |
| **Frontend** | React 18 + TypeScript + Tailwind + Vite. Kjøres i nettleser, snakker HTTP med backend — og med agenten når den finnes lokalt. |
| **Agent** | Lokalt Python-program (port 8002) på maskiner som skal registrere bilder. Har filsystemtilgang: skanner kataloger, leser RAW/JPEG, trekker ut EXIF, genererer previews. Kreves kun for registrering og Lokale verktøy — visning og organisering fungerer uten. |
| **Worker** | Frivillig AI-analyse (CLIP-embeddings, ansikter) mot eget lager (Qdrant), se ADR-022. |
| **Relay** | Frivillig offentlig delingstjeneste for enkeltbilder (ADR-045). |

Se ADR-008 for klient/server-splitten og `docs/deployment.md` for topologi.

## Dataflyt — registrering

1. Brukeren åpner frontend i nettleser og velger en katalog
2. Agenten skanner katalogen og hasher hvert bilde (hotpreview → hothash)
3. Frontend sjekker mot backend hvilke hothasher som er nye (`POST /photos/check-hothashes`)
4. Agenten prosesserer de nye: coldpreview, full EXIF, kvalitetsmetrikker
5. Frontend sender resultatene som JSON (base64-previews) til backend (`POST /input-sessions/{id}/groups`)
6. Backend lagrer metadata i PostgreSQL og skriver coldpreview til disk

Backend leser aldri originalfiler — all filprosessering skjer på klientmaskinen.

## Nettverkstilgang

Backend lytter på `0.0.0.0` i server-/dev-oppsett (nås via Tailscale) og `127.0.0.1` i zip-distribusjon. Planlagt eksponering uten Tailscale via frp-tunnel: ADR-032.
