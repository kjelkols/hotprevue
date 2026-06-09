"""ADR-039: enkeltbilde-deling via hothash-URL."""
import uuid

import pytest
from sqlalchemy import text


def _make_photo(db, *, is_shared=False, share_caption=None, share_downloads=True):
    from models.photo import Photo
    from models.photographer import Photographer

    kind_id = db.execute(text("SELECT id FROM kinds WHERE is_default = true LIMIT 1")).scalar()

    p = Photographer(id=uuid.uuid4(), name="Testfotograf", is_default=True, is_unknown=False, access_level="owner")
    db.add(p)
    db.flush()

    hothash = uuid.uuid4().hex
    photo = Photo(
        id=uuid.uuid4(),
        hothash=hothash,
        hotpreview_b64="fake",
        photographer_id=p.id,
        kind_id=kind_id,
        is_shared=is_shared,
        share_caption=share_caption,
        share_downloads=share_downloads,
    )
    db.add(photo)
    db.commit()
    return hothash


# ---------------------------------------------------------------------------
# GET /share/photo/{hothash}
# ---------------------------------------------------------------------------

def test_shared_photo_not_found(client, db):
    r = client.get("/share/photo/nonexistenthash")
    assert r.status_code == 404


def test_unshared_photo_returns_404(client, db):
    hothash = _make_photo(db, is_shared=False)
    r = client.get(f"/share/photo/{hothash}")
    assert r.status_code == 404


def test_shared_photo_returns_data(client, db):
    hothash = _make_photo(db, is_shared=True, share_caption="Testbilde")
    r = client.get(f"/share/photo/{hothash}")
    assert r.status_code == 200
    data = r.json()
    assert data["hothash"] == hothash
    assert data["share_caption"] == "Testbilde"
    assert data["share_downloads"] is True
    assert "coldpreview_url" in data


def test_shared_photo_increments_view_count(client, db):
    from models.photo import Photo
    hothash = _make_photo(db, is_shared=True)
    client.get(f"/share/photo/{hothash}")
    client.get(f"/share/photo/{hothash}")
    db.expire_all()
    photo = db.query(Photo).filter(Photo.hothash == hothash).first()
    assert photo.share_views == 2


# ---------------------------------------------------------------------------
# GET /share/photo/{hothash}/og
# ---------------------------------------------------------------------------

def test_og_endpoint_returns_html(client, db):
    hothash = _make_photo(db, is_shared=True, share_caption="Min tekst")
    r = client.get(f"/share/photo/{hothash}/og")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    body = r.text
    assert "og:image" in body
    assert "og:title" in body
    assert hothash in body


def test_og_endpoint_404_when_not_shared(client, db):
    hothash = _make_photo(db, is_shared=False)
    r = client.get(f"/share/photo/{hothash}/og")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# GET /share/photo/{hothash}/download
# ---------------------------------------------------------------------------

def test_download_blocked_when_disabled(client, db):
    hothash = _make_photo(db, is_shared=True, share_downloads=False)
    r = client.get(f"/share/photo/{hothash}/download")
    assert r.status_code == 403


def test_download_404_when_not_shared(client, db):
    hothash = _make_photo(db, is_shared=False)
    r = client.get(f"/share/photo/{hothash}/download")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# PATCH /photos/{hothash} — share fields
# ---------------------------------------------------------------------------

def test_patch_enables_sharing(client, db):
    from models.photo import Photo
    hothash = _make_photo(db, is_shared=False)
    r = client.patch(f"/photos/{hothash}", json={"is_shared": True, "share_caption": "Hei"})
    assert r.status_code == 200
    data = r.json()
    assert data["is_shared"] is True
    assert data["share_caption"] == "Hei"


def test_patch_disables_sharing(client, db):
    hothash = _make_photo(db, is_shared=True)
    r = client.patch(f"/photos/{hothash}", json={"is_shared": False})
    assert r.status_code == 200
    assert r.json()["is_shared"] is False
