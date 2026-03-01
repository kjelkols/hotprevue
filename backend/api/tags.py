from fastapi import APIRouter, Depends
from sqlalchemy import func, literal_column
from sqlalchemy.orm import Session

from database.session import get_db
from models.photo import Photo
from schemas.tag import TagOut

router = APIRouter(prefix="/tags", tags=["tags"])


@router.get("", response_model=list[TagOut])
def list_tags(db: Session = Depends(get_db)):
    rows = (
        db.query(
            func.unnest(Photo.tags).label("tag"),
            func.count("*").label("photo_count"),
        )
        .filter(Photo.deleted_at.is_(None))
        .group_by(literal_column("tag"))
        .order_by(literal_column("tag"))
        .all()
    )
    return [TagOut(name=row.tag, photo_count=row.photo_count) for row in rows]
