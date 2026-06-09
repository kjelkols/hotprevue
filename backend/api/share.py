from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import HTMLResponse, Response

from sqlalchemy.orm import Session

from core.config import settings as app_settings
from database.session import get_db
from models.photo import Photo
from models.photographer import Photographer
from schemas.photo import SharedPhotoOut
from services import photo_service

router = APIRouter(prefix="/share", tags=["share"])


def _get_shared_photo(hothash: str, db: Session) -> Photo:
    photo = db.query(Photo).filter(Photo.hothash == hothash, Photo.is_shared.is_(True)).first()
    if photo is None:
        raise HTTPException(status_code=404, detail="Bildet er ikke tilgjengelig")
    return photo


def _photographer_name(photo: Photo, db: Session) -> str | None:
    if not photo.photographer_id:
        return None
    p = db.get(Photographer, photo.photographer_id)
    return p.name if p and not p.is_unknown else None


@router.get("/photo/{hothash}", response_model=SharedPhotoOut)
def get_shared_photo(hothash: str, db: Session = Depends(get_db)):
    photo = _get_shared_photo(hothash, db)
    photo.share_views += 1
    db.commit()
    return SharedPhotoOut(
        hothash=photo.hothash,
        coldpreview_url=f"/photos/{hothash}/coldpreview",
        taken_at=photo.taken_at,
        photographer_name=_photographer_name(photo, db),
        camera_make=photo.camera_make,
        camera_model=photo.camera_model,
        share_caption=photo.share_caption,
        share_downloads=photo.share_downloads,
    )


@router.get("/photo/{hothash}/og", response_class=HTMLResponse)
def get_shared_photo_og(hothash: str, request: Request, db: Session = Depends(get_db)):
    """HTML med OG-tags for sosiale medier. Nettlesere videresendes til React-siden."""
    photo = _get_shared_photo(hothash, db)
    name = _photographer_name(photo, db) or "Hotprevue"
    date_str = photo.taken_at.strftime("%Y-%m-%d") if photo.taken_at else ""
    title = f"{name} — {date_str}" if date_str else name
    description = photo.share_caption or ""
    base = str(request.base_url).rstrip("/")
    image_url = f"{base}/photos/{hothash}/coldpreview"
    redirect_url = f"{base}/#/share/photo/{hothash}"

    html = f"""<!DOCTYPE html>
<html lang="no">
<head>
  <meta charset="utf-8" />
  <title>{title}</title>
  <meta property="og:title" content="{title}" />
  <meta property="og:image" content="{image_url}" />
  <meta property="og:description" content="{description}" />
  <meta property="og:type" content="website" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta http-equiv="refresh" content="0;url={redirect_url}" />
</head>
<body><p>Laster…</p></body>
</html>"""
    return HTMLResponse(content=html)


@router.get("/photo/{hothash}/download")
def download_shared_photo(hothash: str, db: Session = Depends(get_db)):
    photo = _get_shared_photo(hothash, db)
    if not photo.share_downloads:
        raise HTTPException(status_code=403, detail="Nedlasting er ikke tillatt for dette bildet")
    image_bytes, filename = photo_service.build_download(db, hothash, "full")
    return Response(
        content=image_bytes,
        media_type="image/jpeg",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )
