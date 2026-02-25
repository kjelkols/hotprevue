# Utkast: Registreringsflyt og datamodell for input-sesjon

Status: **avklart — innhold overført til spec**
Sist oppdatert: 2026-02-25

Alle åpne spørsmål er avklart. Innholdet er fordelt til:
- `spec/domain.md` — Photo, ImageFile
- `spec/data-model.md` — oppdaterte tabeller
- `spec/api.md` — input-sesjoner, fotografer, photos

---

## Avklarte spørsmål

| Nr | Spørsmål | Svar |
|---|---|---|
| 1 | RAW eller JPEG som master? | RAW prioriteres alltid |
| 2 | rawpy som avhengighet? | Ja, fra start |
| 3 | Review-steg? | Ja, standard — kan slås av via API-parameter |
| 4 | Synkron eller asynkron? | Synkron |
| 5 | 3+ filer flagges? | Ja, i review-steget |
| 6 | XMP-deteksjon? | Ja — lagres som ImageFile med file_type="XMP", ingen innholdslesing |
