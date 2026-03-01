import uuid
from datetime import datetime, timezone
from typing import Any

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from models.photo import Photo
from models.saved_search import SavedSearch
from schemas.saved_search import SavedSearchCreate, SavedSearchPatch, SearchCriterion


def execute(
    db: Session,
    logic: str,
    criteria: list[SearchCriterion],
    sort: str = "taken_at_desc",
    limit: int = 100,
    offset: int = 0,
) -> list[Photo]:
    from services.photo_service import _apply_sort

    q = db.query(Photo).options(selectinload(Photo.correction))
    q = q.filter(Photo.deleted_at.is_(None))

    f = _build_filters(criteria, logic)
    if f is not None:
        q = q.filter(f)

    q = _apply_sort(q, sort)
    return q.offset(offset).limit(limit).all()


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
