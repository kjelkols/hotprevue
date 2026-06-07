import re
import uuid

from fastapi import HTTPException
from sqlalchemy import delete, func, text
from sqlalchemy.orm import Session

from models.tag import PhotoTag, Tag
from schemas.tag import TagCreate, TagMergeResult, TagOut, TagRename, TagSimilar


def _slugify(name: str) -> str:
    return re.sub(r"\s+", " ", name.strip()).lower()


def _tag_with_count(db: Session, tag: Tag) -> TagOut:
    count = db.query(func.count(PhotoTag.photo_id)).filter(PhotoTag.tag_id == tag.id).scalar() or 0
    return TagOut(
        id=tag.id,
        name=tag.name,
        slug=tag.slug,
        created_at=tag.created_at,
        photo_count=count,
    )


def list_all(db: Session) -> list[TagOut]:
    rows = (
        db.query(Tag, func.count(PhotoTag.photo_id).label("cnt"))
        .outerjoin(PhotoTag, PhotoTag.tag_id == Tag.id)
        .group_by(Tag.id)
        .order_by(Tag.name)
        .all()
    )
    return [
        TagOut(id=t.id, name=t.name, slug=t.slug, created_at=t.created_at, photo_count=cnt)
        for t, cnt in rows
    ]


def get_or_404(db: Session, tag_id: uuid.UUID) -> Tag:
    t = db.get(Tag, tag_id)
    if t is None:
        raise HTTPException(status_code=404, detail="Tag ikke funnet")
    return t


def similar(db: Session, name: str) -> list[TagSimilar]:
    slug = _slugify(name)
    rows = db.execute(
        text(
            """
            SELECT t.id, t.name, COUNT(pt.photo_id) AS cnt,
                   similarity(t.name, :name) AS sim
            FROM tags t
            LEFT JOIN photo_tags pt ON pt.tag_id = t.id
            WHERE similarity(t.name, :name) > 0.3
            GROUP BY t.id
            ORDER BY sim DESC
            LIMIT 6
            """
        ),
        {"name": slug},
    ).fetchall()
    return [
        TagSimilar(id=r.id, name=r.name, photo_count=r.cnt, similarity=r.sim)
        for r in rows
    ]


def create(db: Session, data: TagCreate) -> TagOut:
    slug = _slugify(data.name)
    existing = db.query(Tag).filter(Tag.slug == slug).first()
    if existing:
        raise HTTPException(status_code=409, detail=f"Tag med slug '{slug}' finnes allerede")
    tag = Tag(name=data.name.strip(), slug=slug)
    db.add(tag)
    db.commit()
    db.refresh(tag)
    return _tag_with_count(db, tag)


def rename(db: Session, tag_id: uuid.UUID, data: TagRename) -> TagOut:
    tag = get_or_404(db, tag_id)
    new_slug = _slugify(data.name)
    conflict = db.query(Tag).filter(Tag.slug == new_slug, Tag.id != tag_id).first()
    if conflict:
        raise HTTPException(status_code=409, detail=f"Tag med slug '{new_slug}' finnes allerede")
    tag.name = data.name.strip()
    tag.slug = new_slug
    db.commit()
    db.refresh(tag)
    return _tag_with_count(db, tag)


def delete_tag(db: Session, tag_id: uuid.UUID) -> None:
    tag = get_or_404(db, tag_id)
    db.delete(tag)
    db.commit()


def merge(db: Session, source_id: uuid.UUID, target_id: uuid.UUID) -> TagMergeResult:
    if source_id == target_id:
        raise HTTPException(status_code=400, detail="Kilde og mål kan ikke være samme tag")
    source = get_or_404(db, source_id)
    target = get_or_404(db, target_id)

    # Flytt alle koblinger fra source til target, ignorer der target allerede finnes
    db.execute(
        text(
            """
            UPDATE photo_tags SET tag_id = :target
            WHERE tag_id = :source
              AND photo_id NOT IN (
                  SELECT photo_id FROM photo_tags WHERE tag_id = :target
              )
            """
        ),
        {"source": str(source_id), "target": str(target_id)},
    )
    # Slett eventuelle gjenværende source-koblinger (bilder som hadde begge)
    db.execute(
        delete(PhotoTag).where(PhotoTag.tag_id == source_id)
    )
    db.delete(source)
    db.commit()

    merged_count = db.query(func.count(PhotoTag.photo_id)).filter(PhotoTag.tag_id == target_id).scalar() or 0
    db.refresh(target)
    return TagMergeResult(
        target=_tag_with_count(db, target),
        merged_photo_count=merged_count,
    )


def tags_for_photos(db: Session, hothashes: list[str]) -> dict[str, list[str]]:
    """Returner {hothash: [tag_id, ...]} for et sett hothashes."""
    from models.photo import Photo

    rows = (
        db.query(Photo.hothash, PhotoTag.tag_id)
        .join(PhotoTag, PhotoTag.photo_id == Photo.id)
        .filter(Photo.hothash.in_(hothashes))
        .all()
    )
    result: dict[str, list[str]] = {h: [] for h in hothashes}
    for hothash, tag_id in rows:
        result[hothash].append(str(tag_id))
    return result


def add_tag_to_photos(db: Session, tag_id: uuid.UUID, hothashes: list[str]) -> int:
    from models.photo import Photo

    get_or_404(db, tag_id)
    photo_ids = [
        row[0]
        for row in db.query(Photo.id).filter(Photo.hothash.in_(hothashes)).all()
    ]
    added = 0
    for pid in photo_ids:
        exists = db.query(PhotoTag).filter(PhotoTag.photo_id == pid, PhotoTag.tag_id == tag_id).first()
        if not exists:
            db.add(PhotoTag(photo_id=pid, tag_id=tag_id))
            added += 1
    db.commit()
    return added


def remove_tag_from_photos(db: Session, tag_id: uuid.UUID, hothashes: list[str]) -> int:
    from models.photo import Photo

    photo_ids = [
        row[0]
        for row in db.query(Photo.id).filter(Photo.hothash.in_(hothashes)).all()
    ]
    result = db.execute(
        delete(PhotoTag).where(PhotoTag.tag_id == tag_id, PhotoTag.photo_id.in_(photo_ids))
    )
    db.commit()
    return result.rowcount
