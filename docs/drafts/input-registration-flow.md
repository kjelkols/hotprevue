# Utkast: Registreringsflyt og datamodell for input-sesjon

Status: **avklart og overført til spec**
Sist oppdatert: 2026-02-25

Alle spørsmål er avklart. Innholdet er fordelt til:
- `spec/domain.md` — Photo, ImageFile, Input-sesjon, DuplicateFile, SessionError
- `spec/data-model.md` — alle tabeller med korrekte felt
- `spec/api.md` — alle endepunkter inkl. duplikater og sesjonsfeil

---

## Avklarte beslutninger

| Emne | Beslutning |
|---|---|
| Master ved RAW+JPEG | RAW prioriteres alltid |
| rawpy | Avhengighet fra start |
| Review-steg | Standard — kan slås av med `skip_review: true` |
| Prosessering | Synkron |
| Grupper med 3+ filer | Flagges i scan-responsen |
| XMP-filer | Lagres som ImageFile med `file_type = "XMP"`, ingen innholdslesing |
| Duplikathåndtering | Egen `DuplicateFile`-tabell — backend passiv, frontend presenterer |
| Stille sletting av duplikater | Ved neste skanning eller manuell validering |
| Event i sesjon | `none` eller `single` (`default_event_id` nullable) — auto er frontend-ansvar |
| SessionError | Egen tabell med filsti og feilmelding, cascade-slettes med sesjon |
