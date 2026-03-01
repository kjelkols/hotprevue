# 006 – Timeline: arkitektur og date_filter-semantikk

## Kontekst

Tree-timeline ble implementert som en visningsalternativ i søkesiden. Treet er hierarkisk
(år → måned → dag) og baserer seg på `taken_at`-feltet på foto. Klikk på en dag-node viser
alle bildene for den dagen i et vanlig grid-view.

---

## Arkitekturvalg

### 1. Komplett tre i ett API-kall

**Valgt løsning:** `POST /searches/timeline` returnerer hele trestrukturen i én respons:
`list[TimelineYear]` → `list[TimelineMonth]` → `list[TimelineDay]`.

**Alternativet** var lazy loading (hent år → hent måneder ved ekspansjon → hent dager ved
ekspansjon). Det ble valgt bort fordi:
- Samlingen er personlig og sjelden > 50 000 bilder
- Responsen er lett (kun `year`, `month`, `day`, `count`, `cover_hotpreview_b64` per node)
- Én rask respons gir bedre UX enn progressiv innlasting med spinner på hvert nivå

### 2. Cover = nyeste foto i noden

Noden viser det **nyeste** fotoet som cover (tatt_at DESC) for å matche den fallende
tidslinje-ordenen (nyeste øverst). Backend sorterer ascending og tar siste element per gruppe.

### 3. Bilder uten dato ekskluderes

Foto uten `taken_at` ignoreres i timeline. De vises ikke og telles ikke.
Disse krever aktiv oppfølging av bruker via andre verktøy.

### 4. Dag-ekspansjon via navigasjon (ikke inline accordion)

Klikk på en dag-nodes cover → separate dag-view med tilbakeknapp til treet.
År og måned er accordion (ekspanderer inline). Kun dag viser fullt photo grid.

### 5. Trestrukturens expand-tilstand

Initialtilstand: år = ekspandert, måneder = kollaps. Tilstanden er lokal i hver
node-komponent (useState). Treet nullstilles (remount via `key`-prop) når brukeren
kjører et nytt søk.

---

## date_filter-semantikk: alltid AND

### Problemstilling

Når dag-viewet laster bilder bruker det `POST /searches/execute` med det opprinnelige
søket + et datofilter for å begrense til kun den valgte dagen.

Spørsmålet er om datofilter skal **OR'es** eller **AND'es** med de eksisterende
søkekriteriene.

### Konklusjon: alltid AND

Dag-viewet skal vise **"bilder fra søkeresultatet som ble tatt denne dagen"**, ikke
**"bilder fra søkeresultatet ELLER bilder fra denne dagen"**.

Eksempel med OR-logikk i søket:
```
Søkekriterier: rating >= 4 OR tags includes "natur"
Valgt dag: 2024-03-22

Med OR: (rating >= 4) OR (tags includes "natur") OR (taken_at on 2024-03-22)
→ viser ALLE bilder fra 2024-03-22 uavhengig av vurdering eller tags ✗

Med AND (korrekt): (rating >= 4 OR tags includes "natur") AND (taken_at on 2024-03-22)
→ viser kun bilder fra 2024-03-22 som matcher søket ✓
```

### Implementasjon

`date_filter: str | None` er et eget felt på `ExecuteSearchRequest` (ikke en del av
`criteria`-lista). Backend anvender det som separate `.filter()`-kall i SQLAlchemy,
som alltid er AND mellom kall – uavhengig av søkelogikken.

```python
# always ANDed, regardless of the `logic` parameter
if date_filter:
    q = q.filter(Photo.taken_at >= day_start, Photo.taken_at < day_end)
```

Dette er korrekt fordi SQLAlchemy-queryens `.filter()` alltid ANDer betingelsene, mens
`logic`-parameteren kun påvirker konstruksjonen av filteret bygd fra `criteria`-lista.

### Fremtidig bruk

`date_filter` kan gjenbrukes av andre features som trenger å hente en dags bilder
innenfor et søk (f.eks. kalendervisning).
