# Tilgang og deling — arbeidsnotat

**Status:** Utforskende — ikke besluttet
**Sist oppdatert:** 2026-07-04

---

## Formål

Grunnlagsnotat for en bredere analyse av Hotprevue "på dagens stadium" —
gjort som forberedelse til å vurdere om og hvordan systemet skal bli en
plattform andre kan installere og bruke selv, ikke bare et hjemmelaget
verktøy. Dette dokumentet dekker kun første del av gjennomgangen:
tilgangsmodell og delingsprotokoll. Resten av konseptgjennomgangen gjøres
senere.

---

## Utgangspunkt (posisjonering)

Hotprevue har utkrystallisert seg som et ikke-intrusivt hjelpemiddel for
kategorisering av eksisterende bildesamlinger:

- Metadata + previews dekker nesten alt brukeren trenger i arbeidet med
  bilder, bortsett fra detaljert bildeprosessering
- Coldpreview er tilstrekkelig for presentasjon av kurerte samlinger på
  skjerm og i publikasjoner
- Databasen (metadata + previews) er liten selv for hundretusener av bilder
- Konseptet er fleksibelt nok for samarbeid mellom fotografer
- Kan brukes ved siden av Immich eller andre lokale bildeprogrammer uten
  å forstyrre dem
- Ren API-grense mellom FastAPI-backend og frontend gjør at de kan
  utvikles uavhengig av plattform

Dette stemmer godt med den eksisterende kjernesetningen i
`posisjonering.md`: *"Hotprevue er organisasjonslaget for fotoarkiver —
det jobber ved siden av alt du allerede har, uten å ta over noe."*

---

## Tilgangsmodell

### Presiseringer (dette arbeidsnotatet legger disse til grunn)

- Hotprevue bruker PostgreSQL. `pgserver` er kun en embedded kjøremåte for
  lokale installasjoner — ikke et eget databasekonsept.
- **Ingen rom i Hotprevue.** Rom/scoped-lesetilgang er ikke en del av
  Hotprevue sin modell.
- **Fotografer har rettigheter til å se alt.** Rettigheter begrenses kun
  til hva de kan *endre* — ikke hva de kan se. Full lesetilgang er
  standard for alle med noen form for tilgang.
- Hotprevue er et hjelpemiddel for *kurering* (lysbildeserier, album,
  historier) — ikke for offentlig publisering. Publisering er et bevisst
  separat konsept utenfor Hotprevue (**Imalink**, allerede navngitt i
  `posisjonering.md`). Forholdet er én-veis: Hotprevue er kilden, Imalink
  er mottakeren.

### Maskinkonseptet er allerede godt i gang

En gjennomgang av eksisterende ADR-er viste at "maskin"-konseptet —
tenkt som en Syncthing-lignende identitet i stedet for vanlig
bruker-autorisering — allerede er betydelig utviklet:

- **ADR-011** — maskin har én fotograf; løs kobling (kan omattribueres)
- **ADR-040** (Implementert) — `machine_tokens` (bærer-token, kun hash
  lagres), `machine_invite_codes` (8-tegns engangskode med TTL),
  `role`-kolonne (`owner`/`guest`), umiddelbar tilbaketrekking av tilgang
- **ADR-041** (Planlagt) — gjestnode: telefon som PWA-registreringsklient,
  ingen installasjon, bildebehandling skjer i nettleseren
  (Canvas + SubtleCrypto), samme opplastingspipeline som desktop-klienten

**Merk — motsigelse å rydde opp i:** ADR-041 nevner et "privat rom" for
gjestfotografens lesetilgang til et event. Dette strider mot
presiseringen over (ingen rom i Hotprevue) og mot `posisjonering.md`, som
plasserer "Privat rom" i **Imalink**, ikke i Hotprevue. ADR-041 bør trolig
oppdateres til å fjerne den interne rom-referansen — gjestens lesetilgang
etter opptak følger i stedet av den generelle "fotografer ser alt"-regelen.

Gitt "ingen rom" + "full lesetilgang" forenkles ADR-041 sin
gjestefeed-idé fra et isolasjonsmekanisme til en ren
arbeidsflate-visning (nytt/ukuratert materiale), ikke en tilgangsgrense.

### Nettverksgrense i dag

Tailscale er i dag den reelle tillitsgrensen (ikke applikasjonen selv) —
alle maskiner tilhører eieren og er koblet via Tailscale. Dette fungerer
for eier og nærmeste krets, men gjør distribusjon til andre vanskelig:
nye brukere må installere og konfigurere Tailscale, og prosjektet blir
avhengig av en ekstern tredjepart.

---

## Nettverk / delingsprotokoll

### Nøkkelinnsikt

Hotprevue har **ikke** et peer-to-peer-problem — alle klienter (eierens
egne maskiner, gjestens telefon) snakker uansett bare HTTPS mot samme
backend-API. Det er ikke behov for at klienter snakker direkte med
hverandre. Problemet er 1-til-N (backend er alltid det faste punktet),
ikke N-til-N. Det betyr at fullverdige mesh-VPN-løsninger (Nebula,
Headscale, NetBird, libp2p) trolig er overdimensjonert — de løser et
problem Hotprevue ikke har. Riktig kategori er **utgående reverse
tunnel/relay**: backend kobler ut til en relay ved oppstart (virker bak
enhver NAT, ingen portåpning) og får en stabil offentlig HTTPS-adresse.
Installasjonsbyrden havner da kun på serversiden (allerede bundlet i
distribusjonen) — klienter, inkludert gjestens telefon i nettleseren,
trenger ingenting installert.

### Kandidater

| Løsning | Installasjon hos klient | Avhengighet | Vurdering |
|---|---|---|---|
| **rathole/frp + egendriftet relay** | Ingen | Ingen tredjepart, men prosjektet må drifte relay | ADR-032 sin opprinnelige "Fase 1"-konklusjon — trolig fortsatt riktig retning |
| **Pangolin** (fosrl/pangolin) | Ingen (Newt-klient kun på serversiden, userspace) | Selvhostet, AGPL-3, aktivt vedlikeholdt (Fossorial, YC 2025) | Nyere og mer ferdig enn ADR-032 sin analyse fanget opp — gir auto-TLS + identitetsbevisst tilgang, men overlapper delvis med egen auth-modell (ADR-040). Bør evalueres. |
| **Cloudflare Tunnel** | Ingen | Tredjepart (samme innvending som mot Tailscale) | Raskest å skru på, men ikke i tråd med ønsket om uavhengighet |

**Foreløpig anbefaling:** rathole/frp med egendriftet relay er trolig
fortsatt riktig retning for uavhengighet og enkelhet. Pangolin er verdt en
skikkelig evaluering som erstatning for den håndrullede relay-biten,
særlig om automatisk TLS/hostnavn-håndtering er attraktivt — men sjekk om
det drar inn kompleksitet utover det ADR-040 allerede løser.

---

## Invitasjonsdeling

Sikkerheten er løst i ADR-040 (engangskode, TTL, token utstedes ved
enrollment). Det som gjenstår er ren delings-UX:

- **Deep link:** `https://<tunnel-vertsnavn>/pwa/enroll?code=ABCD1234` —
  delt via SMS/melding/e-post, kode forhåndsutfylt ved klikk
- **QR-kode** for samtidig tilstedeværelse (f.eks. fjelltur-scenarioet i
  ADR-041) — eier viser QR, gjest skanner, havner rett på enrollment

Begge krever et stabilt vertsnavn fra tunnel-løsningen — kobler denne
avgjørelsen direkte til nettverksvalget over.

---

## Åpne spørsmål til videre arbeid

1. **Bootstrap-problemet:** hvordan får den aller første owner-maskinen
   sitt token i et scenario uten lokal embedded-installasjon (klient som
   peker mot en allerede kjørende ekstern server)?
2. **Migrering av eksisterende Tailscale-baserte owner-maskiner** til
   token-modellen er eksplisitt utelatt fra ADR-040 sitt scope — må
   avklares hvis Tailscale skal bli valgfritt.
3. **ADR-041 bør oppdateres** til å fjerne "privat rom"-referansen, i tråd
   med presiseringen om at Hotprevue ikke har rom.
4. **Pangolin vs. rathole/frp** — trenger en mer grundig teknisk
   evaluering før valg.
5. Resten av konseptgjennomgangen (målgruppe, "andre" mer presist,
   installasjon/drift for ikke-tekniske brukere) er ikke gjort ennå —
   `posisjonering.md` har allerede mye av dette, bør leses sammen med
   denne gjennomgangen fremover.

---

## Referanser

- `docs/vision/posisjonering.md` — eksisterende posisjonering, Imalink,
  brukerscenarier
- `docs/decisions/008-client-server-split.md`
- `docs/decisions/011-machine-photographer-coupling.md`
- `docs/decisions/032-nettverk-uten-tailscale.md`
- `docs/decisions/040-maskinidentitet-invitasjonskode.md`
- `docs/decisions/041-gjestnode-pwa.md`
