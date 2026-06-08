import uuid

from fastapi import HTTPException
from sqlalchemy.orm import Session, selectinload

from models.photo import Photo
from models.stack import Stack
from schemas.photo import PhotoListItem
from schemas.stack import StackCreate, StackDetail, StackOut


def _stack_out(stack: Stack) -> StackOut:
    cover = next((p for p in stack.photos if p.is_stack_cover), None)
    if cover is None and stack.photos:
        cover = stack.photos[0]
    return StackOut(
        id=stack.id,
        created_at=stack.created_at,
        photo_count=len(stack.photos),
        cover_hothash=cover.hothash if cover else None,
        cover_hotpreview_b64=cover.hotpreview_b64 if cover else None,
    )


def _load_stack(db: Session, stack_id: uuid.UUID) -> Stack:
    stack = (
        db.query(Stack)
        .options(selectinload(Stack.photos).selectinload(Photo.correction))
        .filter(Stack.id == stack_id)
        .first()
    )
    if stack is None:
        raise HTTPException(status_code=404, detail="Stack ikke funnet")
    return stack


def _get_photos_by_hothash(db: Session, hothashes: list[str]) -> list[Photo]:
    photos = db.query(Photo).filter(Photo.hothash.in_(hothashes)).all()
    found = {p.hothash for p in photos}
    missing = [h for h in hothashes if h not in found]
    if missing:
        raise HTTPException(status_code=404, detail=f"Bilder ikke funnet: {missing}")
    return photos


def create(db: Session, data: StackCreate) -> StackOut:
    if not data.hothashes:
        raise HTTPException(status_code=422, detail="Minst ett bilde kreves")

    photos = _get_photos_by_hothash(db, data.hothashes)

    conflicts = [p.hothash for p in photos if p.stack_id is not None]
    if conflicts:
        n = len(conflicts)
        raise HTTPException(
            status_code=409,
            detail=f"{n} {'bilde er' if n == 1 else 'bilder er'} allerede i en stack",
        )

    stack = Stack()
    db.add(stack)
    db.flush()

    for i, p in enumerate(photos):
        p.stack_id = stack.id
        p.is_stack_cover = i == 0

    db.commit()
    db.refresh(stack)
    return _stack_out(_load_stack(db, stack.id))


def list_all(db: Session) -> list[StackOut]:
    stacks = (
        db.query(Stack)
        .options(selectinload(Stack.photos))
        .order_by(Stack.created_at.desc())
        .all()
    )
    return [_stack_out(s) for s in stacks]


def get_one(db: Session, stack_id: uuid.UUID) -> StackDetail:
    stack = _load_stack(db, stack_id)
    return StackDetail(
        id=stack.id,
        created_at=stack.created_at,
        photos=[PhotoListItem.model_validate(p) for p in stack.photos],
    )


def add_photo(db: Session, stack_id: uuid.UUID, hothash: str) -> StackOut:
    stack = _load_stack(db, stack_id)
    photos = _get_photos_by_hothash(db, [hothash])
    photo = photos[0]

    if photo.stack_id == stack_id:
        return _stack_out(stack)
    if photo.stack_id is not None:
        raise HTTPException(status_code=409, detail=f"Bilde {hothash} er allerede i en annen stack")

    photo.stack_id = stack_id
    if not any(p.is_stack_cover for p in stack.photos):
        photo.is_stack_cover = True

    db.commit()
    db.expire_all()
    return _stack_out(_load_stack(db, stack_id))


def add_photos_batch(db: Session, stack_id: uuid.UUID, hothashes: list[str]) -> StackOut:
    stack = _load_stack(db, stack_id)
    photos = db.query(Photo).filter(Photo.hothash.in_(hothashes)).all()

    has_cover = any(p.is_stack_cover for p in stack.photos)
    for photo in photos:
        if photo.stack_id is not None and photo.stack_id != stack_id:
            continue  # best-effort: skip conflicts
        if photo.stack_id == stack_id:
            continue
        photo.stack_id = stack_id
        if not has_cover:
            photo.is_stack_cover = True
            has_cover = True

    db.commit()
    return _stack_out(_load_stack(db, stack_id))


def remove_photo(db: Session, stack_id: uuid.UUID, hothash: str) -> None:
    stack = _load_stack(db, stack_id)
    photo = next((p for p in stack.photos if p.hothash == hothash), None)
    if photo is None:
        raise HTTPException(status_code=404, detail="Bilde ikke i denne stacken")

    was_cover = photo.is_stack_cover
    photo.stack_id = None
    photo.is_stack_cover = False

    remaining = [p for p in stack.photos if p.hothash != hothash]

    if not remaining:
        db.delete(stack)
        db.commit()
        return

    if was_cover:
        remaining[0].is_stack_cover = True

    db.commit()


def set_cover(db: Session, stack_id: uuid.UUID, hothash: str) -> StackOut:
    stack = _load_stack(db, stack_id)
    target = next((p for p in stack.photos if p.hothash == hothash), None)
    if target is None:
        raise HTTPException(status_code=404, detail="Bilde ikke i denne stacken")

    for p in stack.photos:
        p.is_stack_cover = p.hothash == hothash

    db.commit()
    return _stack_out(_load_stack(db, stack_id))


def remove_photos_batch(db: Session, hothashes: list[str]) -> None:
    """Fjern individuelle bilder fra sin stack. Avviser stack-cover-bilder."""
    photos = db.query(Photo).filter(Photo.hothash.in_(hothashes)).all()

    covers = [p.hothash for p in photos if p.is_stack_cover and p.stack_id is not None]
    if covers:
        raise HTTPException(
            status_code=400,
            detail="Stack-cover-bilder kan ikke fjernes individuelt. Bruk 'Oppløs stack' for å oppløse hele stacken.",
        )

    affected_stack_ids = {p.stack_id for p in photos if p.stack_id is not None}

    for p in photos:
        p.stack_id = None
        p.is_stack_cover = False

    db.flush()

    for stack_id in affected_stack_ids:
        remaining = db.query(Photo).filter(Photo.stack_id == stack_id).all()
        if not remaining:
            stack = db.get(Stack, stack_id)
            if stack:
                db.delete(stack)
        elif not any(p.is_stack_cover for p in remaining):
            remaining[0].is_stack_cover = True

    db.commit()


def dissolve_by_photos(db: Session, hothashes: list[str]) -> None:
    """Oppløs stacken som de valgte bildene tilhører. Krever nøyaktig ett stack-cover, ingen løse bilder."""
    photos = db.query(Photo).filter(Photo.hothash.in_(hothashes)).all()

    not_in_stack = [p.hothash for p in photos if p.stack_id is None]
    if not_in_stack:
        raise HTTPException(status_code=400, detail="Noen bilder er ikke i en stack.")

    not_cover = [p.hothash for p in photos if not p.is_stack_cover]
    if not_cover:
        raise HTTPException(
            status_code=400,
            detail="Utvalget inneholder individuelle stack-bilder. Velg kun stack-coveret for å oppløse en stack.",
        )

    stack_ids = {p.stack_id for p in photos}
    if len(stack_ids) > 1:
        raise HTTPException(
            status_code=400,
            detail="Utvalget inneholder flere stacks. Velg bilder fra én stack av gangen.",
        )

    delete(db, next(iter(stack_ids)))


def delete(db: Session, stack_id: uuid.UUID) -> None:
    stack = _load_stack(db, stack_id)
    for p in stack.photos:
        p.stack_id = None
        p.is_stack_cover = False
    db.delete(stack)
    db.commit()
