"""AI worker — polls hotprevue backend for jobs and processes them on tenketank.

Environment variables:
  HOTPREVUE_BACKEND_URL   e.g. http://beelink.tail764ab5.ts.net:8000
  QDRANT_URL              default: http://localhost:6333

Workflow per poll cycle:
  1. GET /ai/jobs?capability=clip → generate CLIP embeddings → POST /ai/results
  2. GET /ai/jobs?capability=faces → detect faces → POST /ai/results
  3. If new face results: run DBSCAN recluster

Crash-safe: no job is "claimed" before processing. If the worker restarts
mid-batch, the same photos are picked up again. Qdrant upserts are idempotent.
"""

import logging
import os
import sys
import time

import httpx

from clip import CLIPIndexer
from clustering import recluster
from faces import FaceIndexer

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("worker")

POLL_INTERVAL = 7       # seconds between idle polls
BATCH_SIZE = 20         # photos per job fetch
BACKOFF_MAX = 300       # cap exponential backoff at 5 minutes
COLDPREVIEW_TIMEOUT = 60  # seconds to fetch a coldpreview


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        log.error("Missing required env var: %s", name)
        sys.exit(1)
    return value


def _fetch_coldpreview(client: httpx.Client, hothash: str) -> bytes:
    resp = client.get(f"/photos/{hothash}/coldpreview", timeout=COLDPREVIEW_TIMEOUT)
    resp.raise_for_status()
    return resp.content


def _poll_clip(client: httpx.Client, clip: CLIPIndexer) -> int:
    jobs = client.get("/ai/jobs", params={"capability": "clip", "limit": BATCH_SIZE}).raise_for_status().json()
    if not jobs:
        return 0

    results = []
    for job in jobs:
        hothash = job["hothash"]
        photo_id = job["photo_id"]
        try:
            jpeg = _fetch_coldpreview(client, hothash)
            qdrant_id = clip.index(photo_id, hothash, jpeg)
            results.append({"hothash": hothash, "capability": "clip", "status": "done", "qdrant_id": qdrant_id})
            log.info("CLIP indexed %s", hothash[:12])
        except Exception as exc:
            log.warning("CLIP failed %s: %s", hothash[:12], exc)
            results.append({"hothash": hothash, "capability": "clip", "status": "error", "error": str(exc)[:400]})

    client.post("/ai/results", json={"results": results}).raise_for_status()
    return len(jobs)


def _poll_faces(client: httpx.Client, face_indexer: FaceIndexer) -> int:
    jobs = client.get("/ai/jobs", params={"capability": "faces", "limit": BATCH_SIZE}).raise_for_status().json()
    if not jobs:
        return 0

    results = []
    for job in jobs:
        hothash = job["hothash"]
        try:
            jpeg = _fetch_coldpreview(client, hothash)
            count = face_indexer.index(hothash, jpeg)
            results.append({"hothash": hothash, "capability": "faces", "status": "done", "face_count": count})
            log.info("Faces indexed %s (%d faces)", hothash[:12], count)
        except Exception as exc:
            log.warning("Faces failed %s: %s", hothash[:12], exc)
            results.append({"hothash": hothash, "capability": "faces", "status": "error", "error": str(exc)[:400]})

    client.post("/ai/results", json={"results": results}).raise_for_status()
    return len(jobs)


def main() -> None:
    backend_url = _require_env("HOTPREVUE_BACKEND_URL").rstrip("/")
    qdrant_url = os.environ.get("QDRANT_URL", "http://localhost:6333")

    log.info("Backend: %s", backend_url)
    log.info("Qdrant:  %s", qdrant_url)

    clip = CLIPIndexer(qdrant_url)
    faces = FaceIndexer(qdrant_url)

    backoff = POLL_INTERVAL

    while True:
        try:
            with httpx.Client(base_url=backend_url, timeout=30) as client:
                clip_n = _poll_clip(client, clip)
                face_n = _poll_faces(client, faces)

            if face_n > 0:
                try:
                    summary = recluster(qdrant_url)
                    log.info("Recluster: %s", summary)
                except Exception as exc:
                    log.warning("Clustering failed: %s", exc)

            if clip_n == 0 and face_n == 0:
                # Nothing to do — idle poll
                backoff = POLL_INTERVAL
            else:
                # More work may be waiting — poll again quickly
                backoff = 1

        except Exception as exc:
            log.error("Poll error: %s", exc)
            backoff = min(backoff * 2, BACKOFF_MAX)

        log.debug("Sleeping %ds", backoff)
        time.sleep(backoff)


if __name__ == "__main__":
    main()
