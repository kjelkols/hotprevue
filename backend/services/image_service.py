"""Image registration service.

Orchestrates: file validation → hotpreview → duplicate check →
coldpreview → EXIF → database write.
"""

import logging
import os

from fastapi import HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from core.config import settings
from models.image import Image
from repositories import image_repo
from schemas.image import ImageRegister
from utils.exif import extract_exif, extract_taken_at
from utils.previews import generate_coldpreview, generate_hotpreview, hotpreview_b64

log = logging.getLogger(__name__)


async def register_image(db: AsyncSession, data: ImageRegister) -> Image:
    # 1. Verify file exists
    if not os.path.isfile(data.file_path):
        raise HTTPException(status_code=422, detail=f"File not found: {data.file_path}")

    # 2. Generate hotpreview and hothash (synchronous — PIL is CPU-bound)
    try:
        jpeg_bytes, hothash = generate_hotpreview(data.file_path)
    except Exception as exc:
        log.exception("Hotpreview generation failed for %s", data.file_path)
        raise HTTPException(status_code=422, detail=f"Could not generate preview: {exc}") from exc

    # 3. Duplicate check
    existing = await image_repo.get_by_hothash(db, hothash)
    if existing is not None:
        raise HTTPException(
            status_code=409,
            detail={"message": "Image already registered", "hothash": hothash},
        )

    # 4. Generate coldpreview
    try:
        coldpreview_path = generate_coldpreview(data.file_path, hothash, settings.coldpreview_dir)
    except Exception as exc:
        log.warning("Coldpreview generation failed for %s: %s", data.file_path, exc)
        coldpreview_path = None

    # 5. Extract EXIF
    exif_data = extract_exif(data.file_path)
    taken_at = extract_taken_at(exif_data)

    # 6. Persist
    image = await image_repo.create(
        db,
        {
            "hothash": hothash,
            "file_path": data.file_path,
            "hotpreview_b64": hotpreview_b64(jpeg_bytes),
            "coldpreview_path": coldpreview_path,
            "exif_data": exif_data or None,
            "rating": data.rating,
            "tags": data.tags,
            "event_id": data.event_id,
            "taken_at": taken_at,
        },
    )
    await db.commit()
    await db.refresh(image)
    return image
