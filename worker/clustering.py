"""DBSCAN clustering of face embeddings stored in Qdrant.

Fetches all face points (with vectors), runs DBSCAN on cosine distances
(normalised vectors + euclidean = cosine), then writes cluster_label back
to each point's payload.

cluster_label == -1  → noise (face not assigned to any cluster)
cluster_label >= 0   → cluster ID (integer)

Run this after each batch of face indexing. It re-clusters from scratch
so new detections are incorporated correctly.
"""

import logging
from typing import Any

import numpy as np
from qdrant_client import QdrantClient
from qdrant_client.models import PointIdsList
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import normalize

log = logging.getLogger(__name__)

COLLECTION = "hotprevue_faces"

# DBSCAN tuning:
# eps=0.45 on L2-normalised 512-dim vectors ≈ cosine distance 0.45 (≈ 0.9 cosine similarity).
# min_samples=2 means at least 2 photos of the same person to form a cluster.
DBSCAN_EPS = 0.45
DBSCAN_MIN_SAMPLES = 2
SCROLL_PAGE = 1000


def recluster(qdrant_url: str) -> dict[str, Any]:
    """Fetch all face embeddings, run DBSCAN, update cluster_label payloads.

    Returns a summary dict: { total_faces, n_clusters, noise }.
    """
    client = QdrantClient(url=qdrant_url)

    # Scroll all face points
    all_ids: list[str] = []
    all_vectors: list[list[float]] = []
    offset = None

    while True:
        result, next_offset = client.scroll(
            collection_name=COLLECTION,
            with_vectors=True,
            limit=SCROLL_PAGE,
            offset=offset,
        )
        for point in result:
            all_ids.append(point.id)
            all_vectors.append(point.vector)
        if next_offset is None:
            break
        offset = next_offset

    if not all_ids:
        log.info("No face points in Qdrant — skipping clustering")
        return {"total_faces": 0, "n_clusters": 0, "noise": 0}

    log.info("Clustering %d face embeddings", len(all_ids))
    X = normalize(np.array(all_vectors, dtype=np.float32))
    labels = DBSCAN(eps=DBSCAN_EPS, min_samples=DBSCAN_MIN_SAMPLES, metric="euclidean", n_jobs=-1).fit_predict(X)

    n_clusters = int((labels >= 0).sum() > 0 and labels.max() + 1 or 0)
    noise = int((labels == -1).sum())

    # Batch-update payloads in Qdrant
    # Group points by cluster_label to minimise API calls
    from collections import defaultdict
    by_label: dict[int, list[str]] = defaultdict(list)
    for point_id, label in zip(all_ids, labels.tolist()):
        by_label[int(label)].append(point_id)

    for label, ids in by_label.items():
        client.set_payload(
            collection_name=COLLECTION,
            payload={"cluster_label": label},
            points=PointIdsList(points=ids),
        )

    log.info("Clustering done: %d clusters, %d noise points", n_clusters, noise)
    return {"total_faces": len(all_ids), "n_clusters": n_clusters, "noise": noise}
