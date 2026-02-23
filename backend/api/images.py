import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from database.session import get_db
from repositories import image_repo
from schemas.image import ImageRead, ImageRegister, ImageUpdate
from services import image_service

router = APIRouter(prefix="/images", tags=["images"])

DbDep = Annotated[AsyncSession, Depends(get_db)]


@router.post("/register", response_model=ImageRead, status_code=201)
async def register_image(body: ImageRegister, db: DbDep):
    return await image_service.register_image(db, body)


@router.get("", response_model=list[ImageRead])
async def list_images(
    db: DbDep,
    event_id: uuid.UUID | None = Query(default=None),
    tags: list[str] | None = Query(default=None),
    rating: int | None = Query(default=None, ge=1, le=5),
    search: str | None = Query(default=None),
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=100, ge=1, le=500),
):
    return await image_repo.list_images(
        db,
        event_id=event_id,
        tags=tags,
        rating=rating,
        search=search,
        skip=skip,
        limit=limit,
    )


@router.get("/{hothash}", response_model=ImageRead)
async def get_image(hothash: str, db: DbDep):
    image = await image_repo.get_by_hothash(db, hothash)
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    return image


@router.patch("/{hothash}", response_model=ImageRead)
async def update_image(hothash: str, body: ImageUpdate, db: DbDep):
    image = await image_repo.update_image(db, hothash, body)
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    await db.commit()
    return image


@router.delete("/{hothash}", status_code=204)
async def delete_image(hothash: str, db: DbDep):
    import os

    image = await image_repo.delete_image(db, hothash)
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    coldpreview_path = image.coldpreview_path
    await db.commit()

    if coldpreview_path and os.path.isfile(coldpreview_path):
        try:
            os.remove(coldpreview_path)
        except OSError:
            pass


@router.get("/{hothash}/coldpreview")
async def get_coldpreview(hothash: str, db: DbDep):
    image = await image_repo.get_by_hothash(db, hothash)
    if image is None:
        raise HTTPException(status_code=404, detail="Image not found")
    if not image.coldpreview_path:
        raise HTTPException(status_code=404, detail="Coldpreview not available")

    import os

    if not os.path.isfile(image.coldpreview_path):
        raise HTTPException(status_code=404, detail="Coldpreview file not found on disk")

    return FileResponse(image.coldpreview_path, media_type="image/jpeg")
