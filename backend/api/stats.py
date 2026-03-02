from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from database.session import get_db
from models.event import Event
from models.input_session import InputSession
from models.photo import Photo
from models.photographer import Photographer

router = APIRouter(prefix="/stats", tags=["stats"])


@router.get("")
def get_stats(db: Session = Depends(get_db)):
    total_photos = db.query(func.count(Photo.id)).filter(Photo.deleted_at == None).scalar() or 0
    total_events = db.query(func.count(Event.id)).scalar() or 0
    total_sessions = db.query(func.count(InputSession.id)).scalar() or 0
    last_registered_at = (
        db.query(func.max(Photo.registered_at)).filter(Photo.deleted_at == None).scalar()
    )

    photographer_rows = (
        db.query(
            Photographer.id,
            Photographer.name,
            Photographer.is_unknown,
            func.count(Photo.id).label("photo_count"),
        )
        .outerjoin(
            Photo,
            (Photo.photographer_id == Photographer.id) & (Photo.deleted_at == None),
        )
        .group_by(Photographer.id, Photographer.name, Photographer.is_unknown)
        .order_by(func.count(Photo.id).desc())
        .all()
    )

    return {
        "total_photos": total_photos,
        "total_events": total_events,
        "total_sessions": total_sessions,
        "last_registered_at": last_registered_at,
        "photographers": [
            {
                "id": str(p.id),
                "name": p.name,
                "is_unknown": p.is_unknown,
                "photo_count": p.photo_count,
            }
            for p in photographer_rows
        ],
    }
