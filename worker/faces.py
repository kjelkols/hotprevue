"""InsightFace face detection + embedding (512-dim) with Qdrant storage.

Each detected face becomes one Qdrant point.
Point IDs are deterministic UUIDs: uuid5(DNS, "{hothash}_{face_index}").
This makes re-indexing idempotent without deleting old points first — the
face count may change between runs, so we delete stale points explicitly.

Payload per face point:
  { hothash, face_index, bbox: [x, y, w, h], det_score }
"""

import io
import logging
import uuid
from datetime import datetime, timezone

import numpy as np
from PIL import Image
from qdrant_client import QdrantClient
from qdrant_client.models import FieldCondition, Filter, FilterSelector, MatchValue, PointStruct

log = logging.getLogger(__name__)

COLLECTION = "hotprevue_faces"
_UUID_NS = uuid.UUID("6ba7b810-9dad-11d1-80b4-00c04fd430c8")  # uuid.NAMESPACE_DNS


def _face_point_id(hothash: str, face_index: int) -> str:
    return str(uuid.uuid5(_UUID_NS, f"{hothash}_{face_index}"))


class FaceIndexer:
    def __init__(self, qdrant_url: str) -> None:
        self._qdrant = QdrantClient(url=qdrant_url)
        log.info("Loading InsightFace buffalo_l")
        import insightface
        self._app = insightface.app.FaceAnalysis(
            name="buffalo_l",
            providers=["CUDAExecutionProvider", "CPUExecutionProvider"],
        )
        self._app.prepare(ctx_id=0, det_size=(640, 640))
        log.info("InsightFace ready")

    def index(self, hothash: str, jpeg_bytes: bytes) -> int:
        """Detect faces in a JPEG image and upsert into Qdrant.

        Replaces any existing face points for this hothash.
        Returns the number of faces detected.
        """
        img = np.array(Image.open(io.BytesIO(jpeg_bytes)).convert("RGB"))
        # InsightFace expects BGR
        img_bgr = img[:, :, ::-1]
        faces = self._app.get(img_bgr)

        # Delete stale face points from previous indexing of this photo
        self._qdrant.delete(
            collection_name=COLLECTION,
            points_selector=FilterSelector(
                filter=Filter(must=[FieldCondition(key="hothash", match=MatchValue(value=hothash))])
            ),
        )

        if not faces:
            return 0

        points = []
        now = datetime.now(timezone.utc).isoformat()
        for i, face in enumerate(faces):
            if face.embedding is None:
                continue
            bbox = face.bbox.astype(int).tolist()  # [x1, y1, x2, y2]
            embedding = (face.embedding / np.linalg.norm(face.embedding)).tolist()
            points.append(
                PointStruct(
                    id=_face_point_id(hothash, i),
                    vector=embedding,
                    payload={
                        "hothash": hothash,
                        "face_index": i,
                        "bbox": bbox,
                        "det_score": float(face.det_score),
                        "cluster_label": -1,
                        "indexed_at": now,
                    },
                )
            )

        if points:
            self._qdrant.upsert(collection_name=COLLECTION, points=points)

        return len(points)
