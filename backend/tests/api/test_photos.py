"""Tests for GET /photos and GET /photos/{hothash}."""
from datetime import datetime, timezone

import pytest

from models.photo import ImageFile, Photo
from models.photographer import Photographer
from utils.previews import generate_coldpreview, generate_hotpreview, hotpreview_b64


def _make_photographer(db, name="Test Photographer"):
    p = Photographer(name=name)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _make_photo(db, photographer_id, file_path, coldpreview_dir):
    jpeg_bytes, hothash = generate_hotpreview(file_path)
    coldpreview_path = generate_coldpreview(file_path, hothash, coldpreview_dir)
    photo = Photo(
        hothash=hothash,
        hotpreview_b64=hotpreview_b64(jpeg_bytes),
        coldpreview_path=coldpreview_path,
        photographer_id=photographer_id,
        exif_data={},
    )
    db.add(photo)
    db.flush()
    db.add(ImageFile(photo_id=photo.id, file_path=file_path, file_type="JPEG", is_master=True))
    db.commit()
    db.refresh(photo)
    return photo


def test_list_photos_empty(client):
    r = client.get("/photos")
    assert r.status_code == 200
    assert r.json() == []


def test_list_photos(client, db, sample_image_path, tmp_path):
    p = _make_photographer(db)
    photo = _make_photo(db, p.id, sample_image_path, str(tmp_path / "coldpreviews"))

    r = client.get("/photos")
    assert r.status_code == 200
    photos = r.json()
    assert len(photos) == 1
    item = photos[0]
    assert item["hothash"] == photo.hothash
    assert "hotpreview_b64" in item
    assert item["has_correction"] is False
    assert "exif_data" not in item  # must never appear in list response


def test_get_photo_detail(client, db, sample_image_path, tmp_path):
    p = _make_photographer(db)
    photo = _make_photo(db, p.id, sample_image_path, str(tmp_path / "coldpreviews"))

    r = client.get(f"/photos/{photo.hothash}")
    assert r.status_code == 200
    detail = r.json()
    assert detail["hothash"] == photo.hothash
    assert "exif_data" in detail
    assert detail["coldpreview_path"] is not None
    assert detail["correction"] is None
    assert len(detail["image_files"]) == 1
    assert detail["image_files"][0]["is_master"] is True


def test_get_photo_not_found(client):
    r = client.get("/photos/doesnotexist")
    assert r.status_code == 404


def test_get_photo_files(client, db, sample_image_path, tmp_path):
    p = _make_photographer(db)
    photo = _make_photo(db, p.id, sample_image_path, str(tmp_path / "coldpreviews"))

    r = client.get(f"/photos/{photo.hothash}/files")
    assert r.status_code == 200
    files = r.json()
    assert len(files) == 1
    assert files[0]["is_master"] is True
    assert files[0]["file_type"] == "JPEG"


def test_list_photos_excludes_deleted_by_default(client, db, sample_image_path, tmp_path):
    p = _make_photographer(db)
    photo = _make_photo(db, p.id, sample_image_path, str(tmp_path / "coldpreviews"))
    photo.deleted_at = datetime.now(timezone.utc)
    db.commit()

    assert client.get("/photos").json() == []
    assert len(client.get("/photos?deleted=true").json()) == 1
