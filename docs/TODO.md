# TODO

Prioritert liste over neste steg. Oppdateres ved hver arbeidsøkt.

Sist oppdatert: 2026-02-25

---

## Pågående

*(ingenting pågår)*

## Neste

### Dokumentasjon
- [ ] Gjennomgå og migrer relevant innhold fra `agent-instructions.md` til riktig spec-fil
- [ ] Fyll ut `spec/data-model.md` med faktisk implementert skjema (verifiser mot Alembic-migrasjoner)
- [ ] Bestem frontend-teknologi og oppdater `spec/frontend.md`

### Backend
- [ ] Implementer Collections (modell, API, tester)
- [ ] Implementer RegisterSession (koble til bilder)
- [ ] Implementer CompanionFiles (modell og API)
- [ ] Filstivalidering — endepunkt for å sjekke status på originalfiler
- [ ] Støtte for Stack (`stack_id`, `is_stack_cover`)

### Infrastruktur
- [ ] Lag `scripts/export-api-docs.sh`
- [ ] Verifiser at `docker compose up` starter alt korrekt

## Backlog

- [ ] Frontend — oppstart og teknologivalg
- [ ] Perceptual hashing for duplikatdeteksjon
- [ ] Batch-oppdatering av filstiprefiks
- [ ] Eksport av collection

## Fullført

*(ingenting fullført ennå i dette formatet)*
