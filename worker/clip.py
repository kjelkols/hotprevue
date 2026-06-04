"""CLIP embedding generation via open-clip-torch (ViT-B-32, 512-dim).

Point IDs in Qdrant are the photo UUID strings.
Payload: { hothash, indexed_at }
"""

import io
import logging
from datetime import datetime, timezone

import numpy as np
import open_clip
import torch
from PIL import Image
from qdrant_client import QdrantClient
from qdrant_client.models import PointStruct

log = logging.getLogger(__name__)

COLLECTION = "hotprevue_clip"
MODEL_NAME = "ViT-B-32"
PRETRAINED = "openai"


class CLIPIndexer:
    def __init__(self, qdrant_url: str) -> None:
        self._qdrant = QdrantClient(url=qdrant_url)
        self._device = "cuda" if torch.cuda.is_available() else "cpu"
        log.info("Loading CLIP %s on %s", MODEL_NAME, self._device)
        self._model, _, self._preprocess = open_clip.create_model_and_transforms(
            MODEL_NAME, pretrained=PRETRAINED, device=self._device
        )
        self._model.eval()
        log.info("CLIP ready")

    def index(self, photo_id: str, hothash: str, jpeg_bytes: bytes) -> str:
        """Embed a JPEG image and upsert into Qdrant.

        Returns the Qdrant point ID (= photo_id).
        Idempotent: re-indexing the same photo_id overwrites the previous point.
        """
        embedding = self._embed(jpeg_bytes)
        point_id = str(photo_id)

        self._qdrant.upsert(
            collection_name=COLLECTION,
            points=[
                PointStruct(
                    id=point_id,
                    vector=embedding.tolist(),
                    payload={"hothash": hothash, "indexed_at": datetime.now(timezone.utc).isoformat()},
                )
            ],
        )
        return point_id

    def _embed(self, jpeg_bytes: bytes) -> np.ndarray:
        img = Image.open(io.BytesIO(jpeg_bytes)).convert("RGB")
        tensor = self._preprocess(img).unsqueeze(0).to(self._device)
        with torch.no_grad(), torch.amp.autocast(self._device):
            features = self._model.encode_image(tensor)
            features = features / features.norm(dim=-1, keepdim=True)
        return features.squeeze(0).cpu().float().numpy()
