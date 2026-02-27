"""Tests for GET /photos and GET /photos/{hothash}."""
from datetime import datetime, timezone

import pytest

from core.config import settings as app_settings
from models.photo import ImageFile, Photo
from models.photographer import Photographer
from utils.previews import generate_coldpreview, generate_hotpreview, hotpreview_b64


@pytest.fixture(autouse=True)
def coldpreview_dir(tmp_path):
    original = app_settings.coldpreview_dir
    coldpreview_test = tmp_path / "coldpreviews"
    coldpreview_test.mkdir()
    app_settings.coldpreview_dir = str(coldpreview_test)
    yield str(coldpreview_test)
    app_settings.coldpreview_dir = original


def _make_photographer(db, name="Test Photographer"):
    p = Photographer(name=name)
    db.add(p)
    db.commit()
    db.refresh(p)
    return p


def _make_photo(db, photographer_id, file_path):
    jpeg_bytes, hothash = generate_hotpreview(file_path)
    generate_coldpreview(file_path, hothash, app_settings.coldpreview_dir)
    photo = Photo(
        hothash=hothash,
        hotpreview_b64=hotpreview_b64(jpeg_bytes),
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


def test_list_photos(client, db, sample_image_path):
    p = _make_photographer(db)
    photo = _make_photo(db, p.id, sample_image_path)

    r = client.get("/photos")
    assert r.status_code == 200
    photos = r.json()
    assert len(photos) == 1
    item = photos[0]
    assert item["hothash"] == photo.hothash
    assert "hotpreview_b64" in item
    assert item["has_correction"] is False
    assert "exif_data" not in item  # must never appear in list response


def test_get_photo_detail(client, db, sample_image_path):
    p = _make_photographer(db)
    photo = _make_photo(db, p.id, sample_image_path)

    r = client.get(f"/photos/{photo.hothash}")
    assert r.status_code == 200
    detail = r.json()
    assert detail["hothash"] == photo.hothash
    assert "exif_data" in detail
    assert "coldpreview_path" not in detail  # internal — never in API response
    assert detail["correction"] is None
    assert len(detail["image_files"]) == 1
    assert detail["image_files"][0]["is_master"] is True


def test_get_photo_not_found(client):
    r = client.get("/photos/doesnotexist")
    assert r.status_code == 404


def test_get_photo_files(client, db, sample_image_path):
    p = _make_photographer(db)
    photo = _make_photo(db, p.id, sample_image_path)

    r = client.get(f"/photos/{photo.hothash}/files")
    assert r.status_code == 200
    files = r.json()
    assert len(files) == 1
    assert files[0]["is_master"] is True
    assert files[0]["file_type"] == "JPEG"


def test_coldpreview_endpoint(client, db, sample_image_path):
    p = _make_photographer(db)
    photo = _make_photo(db, p.id, sample_image_path)

    r = client.get(f"/photos/{photo.hothash}/coldpreview")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert len(r.content) > 0


def test_coldpreview_missing_returns_404(client, db, sample_image_path, tmp_path):
    p = _make_photographer(db)
    photo = _make_photo(db, p.id, sample_image_path)

    # Remove the coldpreview file to simulate missing state
    from pathlib import Path
    hothash = photo.hothash
    cold_file = Path(app_settings.coldpreview_dir) / hothash[:2] / hothash[2:4] / f"{hothash}.jpg"
    cold_file.unlink()

    r = client.get(f"/photos/{hothash}/coldpreview")
    assert r.status_code == 404


def test_list_photos_excludes_deleted_by_default(client, db, sample_image_path):
    p = _make_photographer(db)
    photo = _make_photo(db, p.id, sample_image_path)
    photo.deleted_at = datetime.now(timezone.utc)
    db.commit()

    assert client.get("/photos").json() == []
    assert len(client.get("/photos?deleted=true").json()) == 1
