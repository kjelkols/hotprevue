# Spesifikasjon: Push — lokal til sentral server

## Bakgrunn og motivasjon

Hotprevue støtter to installasjonsmodi: lokal (pgserver på brukerens maskin) og
server (delt PostgreSQL). Push er broen mellom dem: brukeren arbeider lokalt, og
overfører resultatet til en sentral server når han er tilbake på nett.

Primært brukstilfelle er familieturen: flere fotografer registrerer bilder på
hvert sin laptop under turen, og samler alt på én sentral server hjemme.

---

## Brukstilfelle — familietur

**Aktører:**
- Far — 200 bilder, laptop A
- Mor — 150 bilder, laptop B
- Barn — 50 bilder, laptop C

**Under turen (offline):**
- Alle registrerer sine bilder mot lokal backend
- Far og Mor lager event "Familietur 2026" lokalt
- Far rater noen bilder 4 stjerner
- Mor rater noen av de samme bildene 5 stjerner

**Hjemme:**
- Alle tre pusher til sentral server
- Resultatet på sentral server: 400 bilder (minus duplikater via hothash-dedup),
  ett event "Familietur 2026" med alle bildene, ratings bevart

---

## Scope

### Hva Push inkluderer (v1)

- Bilderegistrering (hothash, hotpreview, coldpreview, EXIF, filmetadata)
- Rating per foto
- Event-opprettelse og tilordning av bilder til events

### Hva Push ikke inkluderer (utelatt av kompleksitetshensyn)

- Stacks — se eget avsnitt om hvorfor
- Collections — se eget avsnitt om hvorfor
- Originale bildefiler — backend lagrer aldri originalfiler
- Input-sesjoner — lokale sesjoner er lokale, overføres ikke

---

## Forutsetninger

1. **Sentral server er tilgjengelig** over nett (Tailscale anbefalt).
2. **Bilderegistrering skjer alltid først.** Klienten repointer mot sentral
   backend-URL og registrerer alle bilder via eksisterende
   `POST /input-sessions/{id}/groups`-flyt. Push av organisering forutsetter
   at alle relevante hothashes allerede finnes på sentralserveren.
3. **Lokal backend er intakt** — push leser fra lokal PostgreSQL, ikke fra
   originalfiler.
4. **Maskinen er registrert** på sentralserveren (ADR-011). Push identifiserer
   seg med `machine_id`.

---

## Dataflyt — trinn for trinn

```
Steg 1: Registrer bilder
  Klient repointer til sentral backend-URL
  Klient kjører vanlig registreringsflyt (check-hothashes → groups)
  Resultat: alle bilder finnes på sentral server

Steg 2: Eksporter organisering fra lokal backend
  GET /local/push-export
  Returnerer: events + tilordninger + ratings for alle lokalt registrerte bilder

Steg 3: Push til sentral server
  POST /push
  Body: push-payload (se format under)
  Sentral server validerer, merger, svarer med rapport

Steg 4: Merk som pushet (valgfritt)
  Lokal backend markerer push som fullført med tidsstempel
  Hindrer utilsiktet dobbeltkjøring
```

---

## Payload-format

```json
{
  "machine_id": "uuid-til-lokal-maskin",
  "pushed_at": "2026-07-22T18:00:00Z",
  "events": [
    {
      "name": "Familietur 2026",
      "description": "Sommerferie i Lofoten",
      "date_start": "2026-07-15",
      "date_end": "2026-07-22",
      "parent_event_name": null
    }
  ],
  "photos": [
    {
      "hothash": "abc123...",
      "rating": 4,
      "events": ["Familietur 2026"]
    },
    {
      "hothash": "def456...",
      "rating": null,
      "events": ["Familietur 2026"]
    }
  ]
}
```

**Merk:** Events refereres til ved navn i payload — navn er identitetsmekanismen
(se konfliktløsning under). UUIDs brukes ikke i push-payload.

---

## Konfliktløsning per entitet

### Bilder (hothash)

Hothash er globalt unik identitet — ingen konflikt på eksistens. To maskiner
som sender samme hothash er alltid det samme bildet.

**Rating-konflikt:** Far rater bilde X som 4, Mor rater samme bilde som 5.

| Strategi | Beskrivelse | Anbefaling |
|---|---|---|
| Last-write-wins | Siste push vinner | Uforutsigbar, avhenger av rekkefølge |
| Max-rating | Høyeste verdi vinner | Semantisk naturlig for familie — "noen elsket det" |
| Per-fotograf-rating | Hver maskin har sin rating | Korrekt, men krever skjemaendring |

**Anbefalt for v1: max-rating.** Enkel regel, semantisk fornuftig i familiekontekst.
Krever ingen skjemaendringer. Kan overrides av eksplisitt valg i UI senere.

**Event-tilordning:** Additiv — å tilordne et bilde til et event to ganger er
identisk med én gang. Ingen konflikt.

### Events

**Identitet: navn (case-insensitiv matching).**

"Familietur 2026" fra Far og "familietur 2026" fra Mor er samme event.
UUIDs brukes ikke fordi lokale events har lokalt genererte UUIDs som ikke er
koordinert mellom maskiner.

**Feltkonflikt når event finnes fra før:**

| Felt | Konfliktløsning |
|---|---|
| `description` | Første ikke-tomme verdi vinner (bevar eksisterende) |
| `date_start` | Minimum av alle innsendte verdier |
| `date_end` | Maksimum av alle innsendte verdier |
| `parent_event_name` | Første ikke-null verdi vinner |

Dato-union er semantisk riktig: hvis Far sier turen var 15–20 juli og Mor sier
16–22 juli, er den reelle perioden 15–22 juli.

**Event-hierarki (parent-child):**
Parent refereres til ved navn. Hvis parent ikke finnes på sentral server,
opprettes den som tom event (uten bilder). Rekkefølge i payload-prosessering:
parents opprettes alltid før children.

### Stacks

**Stacks er utelatt fra v1. Begrunnelse:**

Stack = gruppe av bilder av samme motiv. Problemet oppstår ved overlapp:
- Far stacker bildene A, B, C
- Mor stacker B, C, D
- B og C tilhører to stacks — hvilken er korrekt?

Stack-identitet er ikke veldefinert på tvers av maskiner (ingen hothash-ekvivalent
for stacks). Merge-regler er uklare og risikoen for å ødelegge brukerens
organisering er høy. Stacks pusher i en eventuell v2 med eksplisitt
bruker-godkjenning av konflikter.

### Collections

**Collections er utelatt fra v1. Begrunnelse:**

Collections er ordnede, many-to-many-strukturer med captions og tekstkort.
Rekkefølge-merge mellom to uavhengige collections med overlappende bilder
har ingen triviell løsning. Collections er primært et leveranse-/presentasjonsverktøy
som typisk lages etter at alle bilder er samlet — altså etter push, ikke før.

---

## Idempotency

Push skal være trygg å kjøre flere ganger med identisk resultat.

- Bilderegistrering: allerede idempotent via `check-hothashes`
- Events: opprett hvis ikke finnes (navn som nøkkel), oppdater felter etter
  konfliktreglene over
- Ratings: max-rating er idempotent — å sende samme verdi to ganger gir samme resultat
- Event-tilordning: additiv, idempotent

**Delvis push:** Hvis push avbrytes midtveis (nettverksfeil etc.) er det trygt
å kjøre hele pushen på nytt. Ingen dobbeltregistrering, ingen inkonsistent tilstand.

---

## Rekkefølge-avhengigheter

Innad i push-payload prosesseres i denne rekkefølgen:

1. Valider at alle hothashes i payload finnes på sentral server
   → Returner feil med liste over manglende hothashes hvis noen mangler
   → Brukeren må registrere bilder (steg 1) før push av organisering
2. Opprett events (parents før children)
3. Sett ratings på bilder (max-logikk)
4. Tilordne bilder til events

Steg 1 (validering) er kritisk: det er bedre å feile tidlig enn å pushe
halvferdig organisering med hull.

---

## API-design

### Nytt endepunkt på lokal backend

```
GET /local/push-export
```

Returnerer push-payload JSON med alle lokalt registrerte bilder og organisering.
Parametere (valgfritt):
- `?since=<iso-timestamp>` — bare endringer etter dette tidspunktet (inkrementell push)
- `?event=<navn>` — bare bilder i dette eventet

### Nytt endepunkt på sentral backend

```
POST /push
Content-Type: application/json
Body: push-payload (se format over)
```

**Respons:**

```json
{
  "ok": true,
  "photos_updated": 145,
  "photos_skipped_not_found": 5,
  "events_created": 1,
  "events_merged": 2,
  "rating_conflicts_resolved": 12,
  "details": {
    "skipped_hothashes": ["abc123", "def456"],
    "events": [
      { "name": "Familietur 2026", "action": "merged", "photos_added": 87 }
    ]
  }
}
```

`photos_skipped_not_found`: hothashes som var i payload men ikke funnet på server.
Advarsel, ikke feil — bilderegistrering kan kjøres i etterkant.

### Ingen endringer i eksisterende endepunkter

Eksisterende registrerings-API (`/input-sessions/`) er uendret. Push av
organisering er et separat lag oppå.

---

## Feilhåndtering

| Situasjon | Oppførsel |
|---|---|
| Sentral server utilgjengelig | Feil før push starter — ingenting er endret |
| Manglende hothashes | Returner liste, stopp push (ikke delvis push) |
| Ugyldig machine_id | 401 / 403 |
| Nettverksbrudd midtveis | Push er idempotent — kjør på nytt |
| Event-navn-kollisjon med annen case | Case-insensitiv match, slå sammen |
| Tom payload | 200 OK, ingen endringer |

---

## Åpne spørsmål

1. **Rating-strategi:** Er max-rating alltid riktig, eller bør brukeren velge?
   For familiecase er max naturlig. For profesjonell bruk (redaktør velger) kan
   last-write-wins eller eksplisitt override være bedre.

2. **Inkrementell push:** Skal `?since=`-parameteren implementeres i v1, eller
   er full push alltid akseptabelt? Full push er enklere men kan bli treig ved
   store samlinger.

3. **Push-historikk:** Skal lokal backend logge hvem som ble pushet til og når?
   Nyttig for feilsøking, men krever ekstra tabell lokalt.

4. **Bekreftelse i UI:** Skal brukeren se en forhåndsvisning av hva som vil skje
   (antall bilder, events, konflikter) før push gjennomføres? Dry-run-modus?

5. **Stacks i v2:** Hvilken identitetsmekanisme skal brukes? Kandidat: hothash
   til stack-cover som stack-ID. Krever at stack-cover er konsistent på tvers
   av maskiner.

6. **Event-navn som identitet:** Hva hvis to familiemedlemmer bevisst vil ha
   to separate events med samme navn? Usannsynlig for familiecase, men mulig
   i andre kontekster. UUID-basert identitet løser dette men krever koordinering
   ved event-opprettelse.

7. **Tilgangskontroll:** Hvem har lov til å pushe? I dag: ingen autentisering,
   Tailscale-nett er tillitsgrensen. Akseptabelt for familiecase.

8. **Hva med bilder fra andre fotografer?** Kan Far pushe ratings på Mors bilder
   (som far har sett på sentralserveren og ratet der)? Push gjelder bare lokalt
   registrerte bilder — så nei, ikke uten eksplisitt design for det.

---

## Ikke-mål

- Bidireksjonell sync
- Konfliktløsning med bruker-dialog per konflikt (for komplekst for v1)
- Push av originale bildefiler
- Automatisk push (push er alltid en eksplisitt brukerhandling)

---

## Arkitektoniske forutsetninger — hva som ikke må blokkeres

Denne seksjonen dokumenterer hva som må ligge til rette i den øvrige kodebasen
for at Push kan implementeres i fremtiden uten større refaktorering.

### 1. Photographer UUID må komme fra sentralserveren (kritisk)

`photos.photographer_id` er NOT NULL. Ved push må sentralserveren kjenne igjen
photographer-UUID-en fra den lokale maskinen. Dette feiler stille hvis to maskiner
har opprettet "samme" fotograf uavhengig med forskjellige UUIDs:

```
Lokal maskin:     photos.photographer_id = aaaa-...  (generert lokalt)
Sentral server:   photographers.id = cccc-...        (annen UUID for samme person)
Push:             FK-referanse aaaa-... finnes ikke → feil
```

**Constraint på ADR-011-implementasjonen:**
Photographer UUID må genereres på sentralserveren og distribueres til lokale
maskiner — aldri genereres lokalt. Flyten er:

```
1. Bruker setter opp lokal maskin
2. Lokal maskin registrerer seg mot sentral server
3. Sentral server returnerer photographer_id (UUID)
4. Lokal maskin lagrer denne UUID-en permanent
5. Alle lokalt registrerte bilder får denne UUID-en som photographer_id
```

Hvis systemet skal støtte ren offline-first (ingen sentral server ved oppsett),
trenger man en annen strategi — for eksempel en eksplisitt "koble maskin til
fotograf"-operasjon ved første push.

Se også: `docs/decisions/011-machine-photographer-coupling.md`

### 2. Event-navn har ingen unik-constraint (minor)

`events.name` har ingen `UNIQUE`-constraint i databasen. Push bruker navn som
identitetsmekanisme — implementasjonen må håndtere at et navneoppslag kan
returnere flere treff (f.eks. etter manuell duplikatopprettelse). Anbefaling
ved implementasjon: legg til `UNIQUE`-constraint på `events.name`, eller
håndter flertydighet eksplisitt i push-logikken.

### 3. input_session_id på Photo (minor)

`photos.input_session_id` peker på en lokal sesjon-UUID som ikke finnes på
sentralserveren. Ved push må dette feltet settes til null eller til en ny
push-sesjon på sentralserveren. Ingen arkitekturendring nødvendig — bare
en implementasjonsdetalj å huske.
