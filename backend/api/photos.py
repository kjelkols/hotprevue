import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session

from database.session import get_db
from fastapi import File, Form, UploadFile

from schemas.input_session import CheckHothashRequest, CheckHothashResponse
from schemas.photo import (
    BatchBase,
    BatchCategory,
    BatchEvent,
    BatchLocation,
    BatchPhotographer,
    BatchRating,
    BatchResult,
    BatchTakenAt,
    BatchTakenAtOffset,
    CompanionCreate,
    CorrectionPatch,
    ImageFileSchema,
    PhotoDetail,
    PhotoListItem,
    PhotoPatch,
    PerceptualHashComputeResult,
    TimelineBucket,
    TimelineEventBalloon,
)
from services import photo_service

router = APIRouter(prefix="/photos", tags=["photos"])


@router.post("/check-hothashes", response_model=CheckHothashResponse)
def check_hothashes(data: CheckHothashRequest, db: Session = Depends(get_db)):
    return photo_service.check_hothashes(db, data)


@router.get("", response_model=list[PhotoListItem])
def list_photos(
    db: Session = Depends(get_db),
    hothash: list[str] = Query(default=[]),
    photographer_id: uuid.UUID | None = None,
    event_id: uuid.UUID | None = None,
    session_id: uuid.UUID | None = None,
    kind_id: list[uuid.UUID] = Query(default=[]),
    category_id: uuid.UUID | None = None,
    in_stream: bool | None = None,
    rating_min: int | None = None,
    rating_max: int | None = None,
    taken_after: datetime | None = None,
    taken_before: datetime | None = None,
    deleted: bool = False,
    stacks_collapsed: bool = False,
    sort: str = "taken_at_desc",
    limit: int = Query(default=100, le=10000),
    offset: int = 0,
):
    photos = photo_service.list_photos(
        db,
        hothashes=hothash or None,
        photographer_id=photographer_id,
        event_id=event_id,
        session_id=session_id,
        kind_ids=kind_id or None,
        category_id=category_id,
        in_stream=in_stream,
        rating_min=rating_min,
        rating_max=rating_max,
        taken_after=taken_after,
        taken_before=taken_before,
        deleted=deleted,
        stacks_collapsed=stacks_collapsed,
        sort=sort,
        limit=limit,
        offset=offset,
    )
    return [PhotoListItem.model_validate(p) for p in photos]


@router.post("/compute-perceptual-hashes", response_model=PerceptualHashComputeResult)
def compute_perceptual_hashes_for_all(db: Session = Depends(get_db)):
    """Compute dct_perceptual_hash and difference_hash for all photos that lack them.

    Reads hotpreview_b64 from the database — no original files needed.
    Safe to call multiple times; skips photos that already have both hashes.
    """
    return photo_service.compute_perceptual_hashes_for_all(db)


@router.get("/timeline", response_model=list[TimelineBucket])
def get_timeline(
    granularity: str = "month",
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: Session = Depends(get_db),
):
    return photo_service.timeline_buckets(db, granularity, from_date, to_date)


@router.get("/timeline/events", response_model=list[TimelineEventBalloon])
def get_timeline_events(
    from_date: datetime | None = None,
    to_date: datetime | None = None,
    db: Session = Depends(get_db),
):
    return photo_service.timeline_events(db, from_date, to_date)


@router.get("/{hothash}", response_model=PhotoDetail)
def get_photo(hothash: str, db: Session = Depends(get_db)):
    photo = photo_service.get_by_hothash(db, hothash)
    return PhotoDetail.model_validate(photo)


@router.get("/{hothash}/files", response_model=list[ImageFileSchema])
def get_photo_files(hothash: str, db: Session = Depends(get_db)):
    files = photo_service.get_image_files(db, hothash)
    return [ImageFileSchema.model_validate(f) for f in files]


@router.get("/{hothash}/download")
def download_photo(
    hothash: str,
    size: str = Query(default="full", pattern="^(full|medium|small)$"),
    db: Session = Depends(get_db),
):
    """Download a photo as JPEG with embedded EXIF metadata.

    size: full (no resize), medium (max 1200px), small (max 600px).
    """
    image_bytes, filename = photo_service.build_download(db, hothash, size)
    return Response(
        content=image_bytes,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


@router.get("/{hothash}/coldpreview")
def get_coldpreview(hothash: str, db: Session = Depends(get_db)):
    """Serve the coldpreview image, applying any stored correction on-the-fly.

    Returns 404 if the photo does not exist or the coldpreview file is missing.
    ETag is set to the hothash (no correction) or hothash+correction_timestamp (with correction).
    """
    image_bytes, etag = photo_service.serve_coldpreview(db, hothash)
    return Response(
        content=image_bytes,
        media_type="image/jpeg",
        headers={
            "ETag": f'"{etag}"',
            "Cache-Control": "private, max-age=3600",
        },
    )


@router.post("/{hothash}/companions", response_model=ImageFileSchema, status_code=201)
def add_companion(hothash: str, data: CompanionCreate, db: Session = Depends(get_db)):
    companion = photo_service.add_companion(db, hothash, data)
    return ImageFileSchema.model_validate(companion)


@router.patch("/{hothash}", response_model=PhotoDetail)
def patch_photo(hothash: str, data: PhotoPatch, db: Session = Depends(get_db)):
    photo = photo_service.patch_photo(db, hothash, data)
    return PhotoDetail.model_validate(photo)


@router.patch("/{hothash}/correction", response_model=PhotoDetail)
def patch_correction(hothash: str, data: CorrectionPatch, db: Session = Depends(get_db)):
    photo = photo_service.update_correction(db, hothash, data)
    return PhotoDetail.model_validate(photo)


@router.delete("/{hothash}/correction", status_code=204)
def delete_correction(hothash: str, db: Session = Depends(get_db)):
    photo_service.delete_correction(db, hothash)


@router.post("/{hothash}/delete", status_code=204)
def soft_delete_photo(hothash: str, db: Session = Depends(get_db)):
    photo_service.soft_delete(db, hothash)


@router.post("/{hothash}/restore", status_code=204)
def restore_photo(hothash: str, db: Session = Depends(get_db)):
    photo_service.restore(db, hothash)


@router.post("/empty-trash", response_model=BatchResult)
def empty_trash(db: Session = Depends(get_db)):
    count = photo_service.empty_trash(db)
    return BatchResult(updated=count)


# ---------------------------------------------------------------------------
# Batch endpoints
# ---------------------------------------------------------------------------

@router.post("/batch/rating", response_model=BatchResult)
def batch_rating(data: BatchRating, db: Session = Depends(get_db)):
    return BatchResult(updated=photo_service.batch_rating(db, data.hothashes, data.rating))


@router.post("/batch/event", response_model=BatchResult)
def batch_event(data: BatchEvent, db: Session = Depends(get_db)):
    return BatchResult(updated=photo_service.batch_event(db, data.hothashes, data.event_id))


@router.post("/batch/category", response_model=BatchResult)
def batch_category(data: BatchCategory, db: Session = Depends(get_db)):
    return BatchResult(updated=photo_service.batch_category(db, data.hothashes, data.category_id))


@router.post("/batch/photographer", response_model=BatchResult)
def batch_photographer(data: BatchPhotographer, db: Session = Depends(get_db)):
    return BatchResult(updated=photo_service.batch_photographer(db, data.hothashes, data.photographer_id))


@router.post("/batch/taken-at", response_model=BatchResult)
def batch_taken_at(data: BatchTakenAt, db: Session = Depends(get_db)):
    return BatchResult(updated=photo_service.batch_taken_at(db, data.hothashes, data.taken_at, data.taken_at_source))


@router.post("/batch/taken-at-offset", response_model=BatchResult)
def batch_taken_at_offset(data: BatchTakenAtOffset, db: Session = Depends(get_db)):
    return BatchResult(updated=photo_service.batch_taken_at_offset(
        db, data.hothashes, data.offset_seconds, note=data.note,
    ))


@router.post("/batch/location", response_model=BatchResult)
def batch_location(data: BatchLocation, db: Session = Depends(get_db)):
    return BatchResult(updated=photo_service.batch_location(
        db, data.hothashes, data.location_lat, data.location_lng,
        data.location_source, data.location_accuracy,
        location_accuracy_meters=data.location_accuracy_meters,
    ))


@router.post("/batch/delete", response_model=BatchResult)
def batch_delete(data: BatchBase, db: Session = Depends(get_db)):
    return BatchResult(updated=photo_service.batch_delete(db, data.hothashes))


@router.post("/batch/restore", response_model=BatchResult)
def batch_restore(data: BatchBase, db: Session = Depends(get_db)):
    return BatchResult(updated=photo_service.batch_restore(db, data.hothashes))
