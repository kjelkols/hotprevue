# ADR-022: AI-analyselag

**Status:** Planlagt  
**Dato:** 2026-06-04

## Kontekst

Hotprevue skal støtte AI-assistert analyse av bilder: semantiske embeddings (CLIP),
ansiktsgjenkjenning og fremtidige muligheter som bildetekster. Disse funksjonene
skiller seg fra kjernedata på tre måter:

1. **Modell-avhengige** — resultatet varierer med hvilken modell og leverandør som brukes
2. **Forbedres over tid** — brukeren kan kjøre analysen på nytt med bedre modell
3. **Valgfrie** — systemet fungerer fullt uten dem

AI-data skal derfor holdes strengt adskilt fra kjernedata og merkes med full
provenans (leverandør, modell, tidspunkt).

Teknisk bildekvalitet (skarphet, eksponering, støy) er **ikke** AI og behandles
separat i ADR-021.

## Beslutning

### Prinsipp: streng separasjon

AI-genererte data legges aldri på `photos`-tabellen. Alt samles i egne tabeller
som kan slettes og gjenopprettes uten å påvirke kjerneregistreringen.

Brukerdata som oppstår *som følge av* AI — for eksempel navngiving av en
ansiktsklynge — er brukerens data og overlever selv om AI-dataene slettes.

### Datamodell

```sql
-- Én post per AI-kjøring
CREATE TABLE ai_sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    provider        TEXT NOT NULL,   -- 'ollama' | 'openai' | 'anthropic' | 'insightface_local'
    server_url      TEXT,            -- null for lokale biblioteker
    model           TEXT NOT NULL,
    capability      TEXT NOT NULL,   -- 'clip' | 'faces' | 'caption'
    scope           TEXT NOT NULL,   -- 'all' | 'event:<uuid>' | 'collection:<uuid>'
    overwrite       BOOLEAN NOT NULL DEFAULT true,
    status          TEXT NOT NULL DEFAULT 'pending',
    progress        INT NOT NULL DEFAULT 0,
    total           INT,
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    error           TEXT,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CLIP-embeddings (én aktiv per bilde, historikk bevares via session)
CREATE TABLE ai_clip_embeddings (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id        UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    session_id      UUID NOT NULL REFERENCES ai_sessions(id),
    embedding       vector(768) NOT NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Indeks for cosine-similarity-søk (pgvector)
CREATE INDEX ON ai_clip_embeddings USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);

-- Ansiktsdeteksjoner (ett ansikt per rad)
CREATE TABLE ai_face_detections (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id        UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    session_id      UUID NOT NULL REFERENCES ai_sessions(id),
    bbox_x          INT NOT NULL,
    bbox_y          INT NOT NULL,
    bbox_w          INT NOT NULL,
    bbox_h          INT NOT NULL,
    embedding       vector(512) NOT NULL,
    cluster_id      UUID REFERENCES ai_face_clusters(id) ON DELETE SET NULL,
    generated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ansiktsklynger — én per gjenkjent person
CREATE TABLE ai_face_clusters (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name            TEXT,            -- null inntil brukeren navngir — brukerdata
    cover_photo_id  UUID REFERENCES photos(id) ON DELETE SET NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`pgvector`-extension er påkrevd for `vector`-kolonner. Sjekkes ved oppstart
med tydelig feilmelding hvis ikke installert.

### AI-provider-grensesnitt

Hotprevue definerer et capability-basert abstraksjonslag som støtter
hvilken som helst AI-server:

```python
# backend/ai/provider.py
class AIProvider(ABC):
    def capabilities(self) -> set[str]: ...
    # → {'clip', 'faces', 'caption'}

    def available_models(self) -> list[AIModel]: ...

    def generate_clip_embedding(self, jpeg_bytes: bytes) -> list[float]:
        raise NotImplementedError

    def detect_faces(self, jpeg_bytes: bytes) -> list[FaceResult]:
        raise NotImplementedError

    def generate_caption(self, jpeg_bytes: bytes, prompt: str) -> str:
        raise NotImplementedError
```

**Planlagte implementasjoner:**

| Klasse | Capability | Merknad |
|--------|-----------|---------|
| `OllamaProvider(url)` | clip, caption | Bruker Ollama REST API |
| `OpenAIProvider(api_key)` | clip, caption | GPT-4V + text-embedding-3 |
| `AnthropicProvider(api_key)` | caption | Claude Vision |
| `InsightFaceProvider()` | faces | Lokalt Python-bibliotek, ingen server |

Brukeren konfigurerer hvilken provider som brukes per capability i Innstillinger.
Ulike capabilities kan bruke ulike providers:

```json
{
  "clip":    { "provider": "ollama", "url": "http://localhost:11434",
               "model": "nomic-embed-vision" },
  "faces":   { "provider": "insightface_local" },
  "caption": { "provider": "openai", "api_key": "sk-..." }
}
```

### Capability-deteksjon ved tilkobling

Når brukeren oppgir en server-URL detekteres tilgjengelige ressurser automatisk:

- **Ollama:** `GET /api/tags` → modellnavn mappes til capabilities
  (`llava*` → caption, `nomic-embed-vision` → clip)
- **OpenAI-kompatible servere:** `GET /v1/models` — samme mapping
- **InsightFace (lokal):** sjekk om bibliotek og modell er tilgjengelig

Resultatet vises i AI-fanen som en statusoversikt med grønt/rødt per capability.

### AI-worker som separat prosess

Backend er synkron og skal ikke blokkeres av tung prosessering. AI-worker
kjøres som en separat Python-prosess på samme server som backend:

```
backend/
  ai/
    worker.py     — polling-loop, plukker opp pending ai_sessions
    provider.py   — abstrakt grensesnitt
    ollama.py     — OllamaProvider
    openai.py     — OpenAIProvider
    insightface.py — InsightFaceProvider
    clustering.py  — ansiktsklynging (DBSCAN)
```

Worker poller `ai_sessions`-tabellen hvert N sekunder, prosesserer én jobb
av gangen, og oppdaterer `progress`/`status` underveis. Frontend poller
jobbstatus via `GET /ai/sessions/{id}`.

**AI-data leses direkte fra coldpreview-filer på disk** — ingen involvering av
klientagenten. Backend har filsystemtilgang til coldpreview-katalogen.

### Re-kjøring og overskrivingslogikk

AI kan kjøres på nytt — for å bruke bedre modell, inkludere nye bilder, eller
bytte fra lokal til sky-tjeneste.

**Overskrivstrategi per kjøring (brukervalg):**

- **Overskriv eksisterende** (standard): slett gjeldende embeddings/deteksjoner
  for scopet og kjør på nytt. Gammel `ai_session`-post beholdes som historikk.
- **Bare manglende**: hopp over bilder som allerede har data for denne capability.
  Nyttig for å inkludere nyregistrerte bilder uten re-prosessering.

**Brukerdata ved overskriving:**

- CLIP-embeddings overskrives fullstendig — ingen brukerdata knyttet til disse
- Ansiktsdeteksjoner overskrives, men klyngene re-matches mot eksisterende
  `ai_face_clusters` via embedding-likhet. Klynger med > 80% overlap beholder
  sitt navn. Umatched klynger flagges som "trenger gjennomgang".

### Ansiktsgjenkjenning: to faser

**Fase 1 — Deteksjon** (per bilde, parallell):
InsightFace detekterer ansikter i coldpreview → bounding box + 512-dim embedding
per ansikt → lagres i `ai_face_detections`.

**Fase 2 — Klynging** (globalt, kjøres etter deteksjon):
DBSCAN-klynging på alle embeddings → grupper ansikter av samme person →
oppretter/oppdaterer `ai_face_clusters`. Brukeren navngir klynger i AI-fanen.

Klynging re-kjøres automatisk etter enhver ny deteksjonssesjon.

### Modellanbefaling for 16 GB VRAM (Ollama)

| Capability | Modell | VRAM |
|-----------|--------|------|
| CLIP | `nomic-embed-vision` (via Ollama) eller `clip-ViT-L/14` (sentence-transformers) | ~1 GB |
| Ansikter | InsightFace `buffalo_l` | ~1 GB |
| Caption (fremtidig) | `llava:13b` (Q4) | ~8 GB |

Alle tre passer innenfor 16 GB med god margin.

### Privacy per capability

UI viser tydelig hvilke data som sendes til ekstern server:
- Lokale providers (Ollama, InsightFace): ingen data forlater maskinen
- Sky-providers (OpenAI, Anthropic): coldpreviews sendes til ekstern API

Brukeren bekrefter sky-sending eksplisitt første gang per capability.

## Konsekvenser

### Hva som må implementeres

1. `pgvector`-extension i PostgreSQL + verifisering ved oppstart
2. Databasemigrering: `ai_sessions`, `ai_clip_embeddings`,
   `ai_face_detections`, `ai_face_clusters`
3. `backend/ai/` — provider-abstraksjon + implementasjoner
4. AI-worker som systemd-service (eller manuelt startet i utviklingsmodus)
5. Backend-API: `POST /ai/jobs`, `GET /ai/sessions`, `GET /ai/sessions/{id}`
6. Frontend AI-fane:
   - Tilkoblingstatus og capability-oversikt
   - Jobbstart (scope-valg, overskrivstrategi)
   - Fremdriftsvisning
   - Ansiktsklynger med navngiving
   - Semantisk søkefelt (CLIP)
7. BrowseView: sortering på quality_score (ADR-021) og CLIP-søk

### Avhengigheter

- `pgvector` PostgreSQL-extension
- `insightface` + `onnxruntime-gpu` (for InsightFace)
- `sentence-transformers` eller `open-clip-torch` (alternativ til Ollama CLIP)
- `scikit-learn` (DBSCAN for klynging)

### Ikke i scope

- Automatisk re-kjøring ved nye registreringer (watch-modus)
- Bi-direksjonell sync av AI-tagger til XMP (se ADR-020)
- Finjustering / trening av egne modeller
- Ansiktsgjenkjenning på tvers av Hotprevue-instanser
- Moderering av AI-generert innhold
