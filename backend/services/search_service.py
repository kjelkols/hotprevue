import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from models.photo import Photo
from models.saved_search import SavedSearch
from schemas.saved_search import SavedSearchCreate, SavedSearchPatch, SearchCriterion


# ---------------------------------------------------------------------------
# Base query (no eager loading – used by both execute and timeline)
# ---------------------------------------------------------------------------

def _base_query(db: Session, logic: str, criteria: list[SearchCriterion]):
    q = db.query(Photo).filter(Photo.deleted_at.is_(None))
    f = _build_filters(criteria, logic)
    if f is not None:
        q = q.filter(f)
    return q


# ---------------------------------------------------------------------------
# Execute search
# ---------------------------------------------------------------------------

def execute(
    db: Session,
    logic: str,
    criteria: list[SearchCriterion],
    sort: str = "taken_at_desc",
    limit: int = 100,
    offset: int = 0,
    date_filter: str | None = None,
) -> list[Photo]:
    from services.photo_service import _apply_sort

    q = _base_query(db, logic, criteria).options(selectinload(Photo.correction))

    # date_filter is always ANDed regardless of `logic` – see docs/decisions/006-timeline.md
    if date_filter:
        day_start = _parse_dt(date_filter).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = day_start + timedelta(days=1)
        q = q.filter(Photo.taken_at >= day_start, Photo.taken_at < day_end)

    q = _apply_sort(q, sort)
    return q.offset(offset).limit(limit).all()


# ---------------------------------------------------------------------------
# Timeline
# ---------------------------------------------------------------------------

def timeline(db: Session, logic: str, criteria: list[SearchCriterion]) -> list[dict]:
    """Return a year→month→day tree for all dated photos matching the criteria.

    Only photos with taken_at IS NOT NULL are included. Photos without a date
    are excluded; the caller must handle them separately if needed.

    Cover photo per node = newest photo in that node (taken_at DESC).
    Grouping uses UTC dates from the stored taken_at value.
    """
    q = _base_query(db, logic, criteria)

    # Lightweight fetch: only 3 columns, no ORM overhead for corrections etc.
    rows = (
        q.with_entities(Photo.hothash, Photo.hotpreview_b64, Photo.taken_at)
        .filter(Photo.taken_at.isnot(None))
        .order_by(Photo.taken_at.asc())  # ascending so last element = newest
        .all()
    )

    if not rows:
        return []

    # Group by (year, month, day)
    day_map: dict[tuple, list] = defaultdict(list)
    for row in rows:
        key = (row.taken_at.year, row.taken_at.month, row.taken_at.day)
        day_map[key].append(row)

    # Build nested structure – iterate keys newest-first so first-seen cover
    # for each year/month is already the newest day's photo
    year_map: dict[int, dict] = {}

    for (year, month, day) in sorted(day_map.keys(), reverse=True):
        day_rows = day_map[(year, month, day)]
        cover = day_rows[-1]  # last in ascending list = newest photo
        count = len(day_rows)

        if year not in year_map:
            year_map[year] = {"count": 0, "cover": cover, "months": {}}

        ym = year_map[year]["months"]
        if month not in ym:
            ym[month] = {"count": 0, "cover": cover, "days": []}

        year_map[year]["count"] += count
        ym[month]["count"] += count
        ym[month]["days"].append({
            "day": day,
            "count": count,
            "cover_hothash": cover.hothash,
            "cover_hotpreview_b64": cover.hotpreview_b64,
        })

    # Serialize – newest year/month first; days already in descending order
    result = []
    for year in sorted(year_map.keys(), reverse=True):
        y = year_map[year]
        months = []
        for month in sorted(y["months"].keys(), reverse=True):
            m = y["months"][month]
            months.append({
                "month": month,
                "count": m["count"],
                "cover_hothash": m["cover"].hothash,
                "cover_hotpreview_b64": m["cover"].hotpreview_b64,
                "days": m["days"],
            })
        result.append({
            "year": year,
            "count": y["count"],
            "cover_hothash": y["cover"].hothash,
            "cover_hotpreview_b64": y["cover"].hotpreview_b64,
            "months": months,
        })

    return result


# ---------------------------------------------------------------------------
# Filter builders
# ---------------------------------------------------------------------------

def _build_filters(criteria: list[SearchCriterion], logic: str):
    from sqlalchemy import and_, or_

    clauses = [c for crit in criteria if (c := _criterion_to_clause(crit)) is not None]
    if not clauses:
        return None
    return or_(*clauses) if logic == "OR" else and_(*clauses)


def _criterion_to_clause(c: SearchCriterion):
    field, op, value = c.field, c.operator, c.value

    if field == "rating":
        if op == "eq":
            return Photo.rating == value
        if op == "gte":
            return Photo.rating >= value
        if op == "lte":
            return Photo.rating <= value
        if op == "is_null":
            return Photo.rating.is_(None)

    elif field == "taken_at":
        if op == "after" and value:
            return Photo.taken_at >= _parse_dt(value)
        if op == "before" and value:
            return Photo.taken_at <= _parse_dt(value)
        if op == "between" and isinstance(value, list) and len(value) == 2:
            return Photo.taken_at.between(_parse_dt(value[0]), _parse_dt(value[1]))

    elif field == "tags":
        if op == "any_of" and value:
            return Photo.tags.overlap(value)
        if op == "all_of" and value:
            return Photo.tags.contains(value)
        if op == "none_of" and value:
            from sqlalchemy import not_
            return not_(Photo.tags.overlap(value))

    elif field == "photographer_id":
        if op == "eq" and value:
            return Photo.photographer_id == uuid.UUID(value)
        if op == "neq" and value:
            return Photo.photographer_id != uuid.UUID(value)

    elif field == "event_id":
        if op == "eq" and value:
            return Photo.event_id == uuid.UUID(value)
        if op == "neq" and value:
            return Photo.event_id != uuid.UUID(value)
        if op == "is_null":
            return Photo.event_id.is_(None)

    elif field == "camera_make":
        if op == "eq" and value:
            return Photo.camera_make == value
        if op == "contains" and value:
            return Photo.camera_make.ilike(f"%{value}%")

    elif field == "camera_model":
        if op == "eq" and value:
            return Photo.camera_model == value
        if op == "contains" and value:
            return Photo.camera_model.ilike(f"%{value}%")

    return None


def _parse_dt(value: Any) -> datetime:
    if isinstance(value, datetime):
        return value
    dt = datetime.fromisoformat(str(value))
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def list_searches(db: Session) -> list[SavedSearch]:
    return db.query(SavedSearch).order_by(SavedSearch.name).all()


def get_or_404(db: Session, search_id: uuid.UUID) -> SavedSearch:
    s = db.query(SavedSearch).filter(SavedSearch.id == search_id).first()
    if s is None:
        raise HTTPException(status_code=404, detail="Search not found")
    return s


def create(db: Session, data: SavedSearchCreate) -> SavedSearch:
    s = SavedSearch(
        name=data.name,
        description=data.description,
        logic=data.logic,
        criteria=[c.model_dump() for c in data.criteria],
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def patch(db: Session, search_id: uuid.UUID, data: SavedSearchPatch) -> SavedSearch:
    s = get_or_404(db, search_id)
    updates = data.model_dump(exclude_unset=True)
    if "criteria" in updates and updates["criteria"] is not None:
        updates["criteria"] = [c.model_dump() for c in (data.criteria or [])]
    for field, value in updates.items():
        setattr(s, field, value)
    s.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(s)
    return s


def delete(db: Session, search_id: uuid.UUID) -> None:
    s = get_or_404(db, search_id)
    db.delete(s)
    db.commit()
