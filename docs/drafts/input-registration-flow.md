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
| Master ved RAW+JPEG | JPEG prioriteres (Pillow støtter EXIF-lesing fra JPEG, ikke NEF/RAW) |
| rawpy | Ikke tatt inn — JPEG brukes som master |
| Review-steg | Fjernet — backend registrerer én gruppe om gangen uten bekreftelsessteg |
| Prosessering | Synkron |
| Grupper med 3+ filer | Støttes — alle companion-filer sendes som metadata i group-endepunktet |
| XMP-filer | Lagres som ImageFile med `file_type = "XMP"`, ingen innholdslesing |
| Duplikathåndtering | Egen `DuplicateFile`-tabell — backend passiv, frontend presenterer |
| Stille sletting av duplikater | Ved neste skanning eller manuell validering |
| Event i sesjon | `none` eller `single` (`default_event_id` nullable) — auto er frontend-ansvar |
| SessionError | Egen tabell med filsti og feilmelding, cascade-slettes med sesjon |
