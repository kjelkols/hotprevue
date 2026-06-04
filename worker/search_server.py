"""CLIP-based semantic search server.

Runs as a daemon thread inside the worker process.
Exposes GET /search?q=<text>&limit=<n> → [{hothash, score}]
"""

import logging

import uvicorn
from fastapi import FastAPI, Query
from pydantic import BaseModel

log = logging.getLogger(__name__)

app = FastAPI(title="Hotprevue search", docs_url=None, redoc_url=None)


class SearchResult(BaseModel):
    hothash: str
    score: float


_clip_indexer = None
_qdrant_url: str = ""


def init(clip_indexer, qdrant_url: str) -> None:
    global _clip_indexer, _qdrant_url
    _clip_indexer = clip_indexer
    _qdrant_url = qdrant_url


@app.get("/search", response_model=list[SearchResult])
def search(q: str = Query(..., min_length=1), limit: int = Query(default=20, le=100)):
    if _clip_indexer is None:
        return []

    from qdrant_client import QdrantClient
    from qdrant_client.models import Query
    import torch

    model = _clip_indexer._model
    preprocess = _clip_indexer._preprocess
    device = _clip_indexer._device

    import open_clip
    tokenizer = open_clip.get_tokenizer("ViT-B-32")
    tokens = tokenizer([q]).to(device)

    with torch.no_grad(), torch.amp.autocast(device):
        text_features = model.encode_text(tokens)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

    vector = text_features.squeeze(0).cpu().float().tolist()

    client = QdrantClient(url=_qdrant_url)
    result = client.query_points(
        collection_name="hotprevue_clip",
        query=vector,
        limit=limit,
        with_payload=True,
    )

    return [
        SearchResult(hothash=hit.payload["hothash"], score=round(hit.score, 4))
        for hit in result.points
        if hit.payload and "hothash" in hit.payload
    ]


def start(port: int = 8001) -> None:
    log.info("Starting search server on port %d", port)
    uvicorn.run(app, host="0.0.0.0", port=port, log_level="warning")
