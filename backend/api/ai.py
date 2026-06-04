import uuid
from datetime import datetime, timezone
from typing import Literal

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from core.config import settings
from database.session import get_db
from models.ai import AiPhotoStatus

router = APIRouter(prefix="/ai", tags=["ai"])

_CAPABILITIES = {"clip", "faces"}


class AiJob(BaseModel):
    photo_id: uuid.UUID
    hothash: str


class AiResult(BaseModel):
    hothash: str
    capability: str
    status: Literal["done", "error"]
    qdrant_id: str | None = None
    face_count: int | None = None
    error: str | None = None


class AiResultsPayload(BaseModel):
    results: list[AiResult]


class AiResultsResponse(BaseModel):
    accepted: int


class AiStatusSummary(BaseModel):
    capability: str
    total_photos: int
    done: int
    errors: int
    pending: int


class SearchResult(BaseModel):
    hothash: str
    score: float


@router.get("/search", response_model=list[SearchResult])
def search_photos(
    q: str = Query(..., min_length=1),
    limit: int = Query(default=20, le=100),
):
    if not settings.ai_search_url:
        raise HTTPException(status_code=503, detail="AI_SEARCH_URL ikke konfigurert")
    url = settings.ai_search_url.rstrip("/") + "/search"
    try:
        resp = httpx.get(url, params={"q": q, "limit": limit}, timeout=15)
        resp.raise_for_status()
        return resp.json()
    except httpx.ConnectError:
        raise HTTPException(status_code=503, detail="Søketjenesten er ikke tilgjengelig")
    except httpx.HTTPStatusError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@router.get("/jobs", response_model=list[AiJob])
def get_ai_jobs(
    capability: str = Query(..., description="'clip' or 'faces'"),
    limit: int = Query(default=20, le=200),
    db: Session = Depends(get_db),
):
    """Return photos that need AI analysis for the given capability.

    Photos with no status row or status='error' are returned, oldest first.
    """
    if capability not in _CAPABILITIES:
        raise HTTPException(status_code=400, detail=f"Unknown capability: {capability}")

    rows = db.execute(
        text("""
            SELECT p.id AS photo_id, p.hothash
            FROM photos p
            LEFT JOIN ai_photo_status s
                ON s.photo_id = p.id AND s.capability = :capability
            WHERE p.deleted_at IS NULL
              AND (s.status IS NULL OR s.status = 'error')
            ORDER BY p.registered_at ASC
            LIMIT :limit
        """),
        {"capability": capability, "limit": limit},
    ).fetchall()

    return [AiJob(photo_id=row.photo_id, hothash=row.hothash) for row in rows]


@router.post("/results", response_model=AiResultsResponse)
def post_ai_results(payload: AiResultsPayload, db: Session = Depends(get_db)):
    """Accept batch results from the AI worker.

    Upserts an AiPhotoStatus row per result. Unknown hothashes are silently skipped.
    """
    hothashes = [r.hothash for r in payload.results]
    photo_rows = db.execute(
        text("SELECT id, hothash FROM photos WHERE hothash = ANY(:hashes)"),
        {"hashes": hothashes},
    ).fetchall()
    hothash_to_id: dict[str, uuid.UUID] = {row.hothash: row.id for row in photo_rows}

    now = datetime.now(timezone.utc)
    accepted = 0

    for result in payload.results:
        photo_id = hothash_to_id.get(result.hothash)
        if photo_id is None:
            continue

        existing = db.get(AiPhotoStatus, (photo_id, result.capability))
        if existing:
            existing.status = result.status
            existing.qdrant_id = result.qdrant_id
            existing.face_count = result.face_count
            existing.analyzed_at = now
            existing.error = result.error
        else:
            db.add(
                AiPhotoStatus(
                    photo_id=photo_id,
                    capability=result.capability,
                    status=result.status,
                    qdrant_id=result.qdrant_id,
                    face_count=result.face_count,
                    analyzed_at=now,
                    error=result.error,
                )
            )
        accepted += 1

    db.commit()
    return AiResultsResponse(accepted=accepted)


@router.get("/status", response_model=list[AiStatusSummary])
def get_ai_status(db: Session = Depends(get_db)):
    """Return a summary of AI analysis progress per capability."""
    total = db.execute(
        text("SELECT count(*) FROM photos WHERE deleted_at IS NULL")
    ).scalar()

    summaries = []
    for capability in sorted(_CAPABILITIES):
        rows = db.execute(
            text("""
                SELECT status, count(*) AS n
                FROM ai_photo_status
                WHERE capability = :cap
                GROUP BY status
            """),
            {"cap": capability},
        ).fetchall()
        counts = {row.status: row.n for row in rows}
        done = counts.get("done", 0)
        errors = counts.get("error", 0)
        summaries.append(
            AiStatusSummary(
                capability=capability,
                total_photos=total,
                done=done,
                errors=errors,
                pending=total - done - errors,
            )
        )
    return summaries
