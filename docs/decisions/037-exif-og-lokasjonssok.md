# ADR-037: EXIF-felter og lokasjonsbasert søk

**Status:** Planlagt  
**Dato:** 2026-06-08

---

## Kontekst

Alle tekniske EXIF-parametere er allerede lagret som dedikerte kolonner på
`photos`-tabellen — `iso`, `aperture`, `focal_length`, `lens_model`,
`shutter_speed`, `location_lat`, `location_lng` — men ingen av disse er
eksponert via søketjenesten. ADR-023 vurderte numeriske EXIF-felt og utsatte
dem med begrunnelsen «sjelden primærkriterium». En gjennomgang av
funksjonalitet som bør være på plass før produksjonsdeploy viser at dette
er feil prioritering:

**Data som finnes men ikke er søkbar er i praksis usynlig.** En bruker med
30 000 bilder kan ikke finne alle portrettbilder tatt med 85 mm-linse, alle
bilder på ISO 3200 i svakt lys, eller alle bilder fra en bestemt reise —
selv om all informasjonen er i basen.

**Ingen datainnhenting trengs i ettertid.** Fordi kolonnene allerede
eksisterer og er populert ved registrering, er dette rent et søklag-problem.
Ingen re-skanning av originalfiler, ingen Alembic-migrasjon for nye kolonner.

**GPS er lagret men ikke søkbart.** `location_lat` og `location_lng` er
satt på bilder med GPS-data, og `LocationEditorPage` lar brukeren redigere
dem — men det finnes ingen måte å spørre «alle bilder fra Bergen» eller
«alle bilder tatt utenfor Norge».

ADR-023 dekker den overordnede søkarkitekturen. Denne ADR-en er en
utledning som spesifiserer nøyaktig hvilke nye felt som legges til og
hvordan de implementeres.

---

## Beslutning

### 1. Nye søkefelt i søkemotoren

Følgende felt legges til i `_build_criterion` i `search_service.py`:

#### ISO

```
felt:      iso
type:      Integer
operatorer: gte, lte, eq, between, is_null
eksempel:  iso >= 3200
```

#### Blenderåpning

```
felt:      aperture
type:      Float
operatorer: gte, lte, eq, between, is_null
eksempel:  aperture <= 2.8
```

Verdier lagres som f-tall (f/2.8 → `2.8`). UI viser «f/2.8».

#### Brennvidde

```
felt:      focal_length
type:      Float
operatorer: gte, lte, eq, between, is_null
eksempel:  focal_length = 85.0
```

Verdier i mm. UI viser «85 mm».

#### Linsemodell

```
felt:      lens_model
type:      String
operatorer: eq, contains, is_null
eksempel:  lens_model contains "85mm"
```

Nyttig for brukere med mange linser; `contains` er viktig fordi
linsenavn fra EXIF varierer («EF 85mm», «85/1.4», etc.).

#### Orientering

```
felt:      orientation
type:      virtuelt (avledet av width × height)
operatorer: eq   (verdier: "portrait", "landscape", "square")
eksempel:  orientation = "portrait"
```

Ingen ny kolonne. SQL-oversetting:

```python
if value == "portrait":
    return Photo.height > Photo.width
elif value == "landscape":
    return Photo.width > Photo.height
elif value == "square":
    return Photo.width == Photo.height
```

#### Har lokasjon

```
felt:      has_location
type:      Boolean
operatorer: eq  (true / false)
eksempel:  has_location = true
```

SQL: `Photo.location_lat.is_not(None)` / `Photo.location_lat.is_(None)`.

#### Lokasjonsradius

```
felt:      location_radius
type:      sammensatt
operatorer: within  (eneste)
verdi:     { lat: float, lng: float, radius_km: float }
eksempel:  location_radius within { lat: 60.39, lng: 5.32, radius_km: 25 }
```

Implementeres med Haversine-formel i ren SQL — ingen PostGIS-avhengighet:

```python
# Bounding-box som grovfilter (rask med indeks), deretter nøyaktig avstand
lat, lng, r = value["lat"], value["lng"], value["radius_km"]
lat_delta = r / 111.0          # 1 grad ≈ 111 km
lng_delta = r / (111.0 * math.cos(math.radians(lat)))

bb = and_(
    Photo.location_lat.between(lat - lat_delta, lat + lat_delta),
    Photo.location_lng.between(lng - lng_delta, lng + lng_delta),
)

# Haversine for nøyaktig radius
dlat = func.radians(Photo.location_lat - lat)
dlng = func.radians(Photo.location_lng - lng)
a = (
    func.pow(func.sin(dlat / 2), 2)
    + func.cos(func.radians(lat))
    * func.cos(func.radians(Photo.location_lat))
    * func.pow(func.sin(dlng / 2), 2)
)
dist_km = 6371 * 2 * func.asin(func.sqrt(a))

return and_(bb, dist_km <= r)
```

Bounding-box-filteret gjør at Haversine kun beregnes for bilder innenfor
den omtrentlige firkanten — effektivt også uten romlig indeks.

---

### 2. Indekser

```sql
CREATE INDEX ix_photos_iso          ON photos (iso)          WHERE iso IS NOT NULL;
CREATE INDEX ix_photos_aperture     ON photos (aperture)     WHERE aperture IS NOT NULL;
CREATE INDEX ix_photos_focal_length ON photos (focal_length) WHERE focal_length IS NOT NULL;
CREATE INDEX ix_photos_location     ON photos (location_lat, location_lng)
                                    WHERE location_lat IS NOT NULL;
```

Partial index (WHERE IS NOT NULL) unngår indeksering av de mange radene
der feltet er tomt.

---

### 3. Frontend — searchFields.ts

Nye felt legges til i `SEARCH_FIELDS`-konfigurasjonen:

| `id` | Label | Operatorer | Input-type |
|------|-------|-----------|------------|
| `iso` | ISO | gte, lte, eq, between, is_null | Number |
| `aperture` | Blenderåpning | gte, lte, eq, between, is_null | ApertureInput |
| `focal_length` | Brennvidde (mm) | gte, lte, eq, between, is_null | Number |
| `lens_model` | Linse | eq, contains, is_null | Text |
| `orientation` | Orientering | eq | Select (portrett/landskap/kvadrat) |
| `has_location` | Har GPS | eq | Toggle (ja/nei) |
| `location_radius` | Innen avstand | within | LocationRadiusInput |

`ApertureInput`: viser «f/» som prefiks, lagrer ren float. Tillater
input som `2.8`, `f/2.8`, `f2.8` — normaliseres til `2.8`.

`LocationRadiusInput`: kart-mini-widget eller koordinat-input med
radius-slider (1–500 km). Verdier fra `LocationEditorPage` kan kopieres
inn. Kan implementeres med rå koordinatinput i første omgang.

---

### 4. Schemas

`SearchCriterion.value` er allerede `Any`. Ingen schema-endring trengs.
`location_radius`-verdien er et lite JSON-objekt — deserialiserbart med
`pydantic` som en `dict` med validering i `_build_criterion`.

---

## Begrunnelse

**Hvorfor ikke PostGIS?** PostGIS er en stor avhengighet for en
enkeltbruker-applikasjon. Haversine-tilnærmingen gir sub-millimeter-
nøyaktighet for avstand på jordoverflaten. Radius-søk på fotografi-data
krever aldri kartografisk presisjon — «innen 25 km fra Bergen» er
tilstrekkelig.

**Hvorfor orientering som virtuelt felt?** Å legge til en `orientation`-kolonne
betyr en migrasjon og et vedlikeholdskrav (hva skjer om `width`/`height`
oppdateres?). SQL-uttrykket er trivielt og alltid konsistent med faktisk
bildestørrelse.

**Lukkertid som streng.** `shutter_speed` er lagret som «1/125», «1/2000»
osv. (menneskelig lesbar form, ikke desimalverdi). Å søke på lukkertid
krever enten en ny Float-kolonne (`shutter_speed_seconds`) eller en
beregnet uttrykksindeks. Tas ikke i denne ADR-en — bruk-tilfellet er svakt
og kompleksiteten unødvendig.

---

## Implementeringsplan

| Steg | Fil | Innhold |
|------|-----|---------|
| 1 | `backend/services/search_service.py` | Legg til 7 nye `elif field ==`-blokker |
| 2 | `backend/alembic/versions/…_exif_indexes.py` | 4 partial indexes |
| 3 | `frontend/src/features/search/searchFields.ts` | 7 nye felt-definisjoner |
| 4 | `frontend/src/features/search/SearchValueInput.tsx` | ApertureInput + LocationRadiusInput |
| 5 | `backend/tests/api/test_search.py` | Tester per felt (ISO-range, radius-søk, orientering) |

---

## Konsekvenser

**Gevinst:** Alle tekniske EXIF-parametere som allerede er lagret blir
søkbare. Ingen nye registreringskrav — eksisterende bilder dekkes
automatisk. Radius-søk gjør GPS-data som LocationEditorPage allerede
samler inn nyttig som søkekriterie.

**Kostnad:** ~200 linjer ny kode totalt. Ingen nye datamodell-avhengigheter.
LocationRadiusInput-komponenten er den eneste ikke-trivielle UI-biten.

**Ikke i scope:**
- Lukkertid-søk (krever ny kolonne eller beregnet indeks)
- Polygon/bounding-box-søk (region-tegning på kart)
- Geo-clustering (bilder gruppert etter sted)
- Fasettert telling per EXIF-verdi (histogram over ISO-verdier, etc.)
