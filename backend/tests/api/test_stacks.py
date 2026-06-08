"""Tests for /stacks endpoints."""
import uuid

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_photo(db, kind_id) -> str:
    from models.photo import Photo
    from models.photographer import Photographer

    photographer = db.query(Photographer).first()
    if not photographer:
        photographer = Photographer(name="Test")
        db.add(photographer)
        db.flush()

    hothash = uuid.uuid4().hex
    photo = Photo(hothash=hothash, hotpreview_b64="", kind_id=kind_id, photographer_id=photographer.id)
    db.add(photo)
    db.commit()
    return hothash


def _make_photos(db, kind_id, n=2) -> list[str]:
    return [_make_photo(db, kind_id) for _ in range(n)]


def _create_stack(client, hothashes, kind="selection"):
    r = client.post("/stacks", json={"hothashes": hothashes, "kind": kind})
    assert r.status_code == 201
    return r.json()


# ---------------------------------------------------------------------------
# Create
# ---------------------------------------------------------------------------

def test_create_stack_returns_201(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 3)
    data = _create_stack(client, hashes)
    assert data["photo_count"] == 3
    assert data["kind"] == "selection"
    assert data["cover_hothash"] == hashes[0]


def test_create_stack_sets_cover_on_first_photo(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 2)
    data = _create_stack(client, hashes)
    assert data["cover_hothash"] == hashes[0]


def test_create_stack_with_kind(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 2)
    data = _create_stack(client, hashes, kind="panorama")
    assert data["kind"] == "panorama"


def test_create_stack_empty_hothashes_returns_422(client):
    r = client.post("/stacks", json={"hothashes": []})
    assert r.status_code == 422


def test_create_stack_photo_already_in_stack_returns_409(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 2)
    _create_stack(client, hashes)
    r = client.post("/stacks", json={"hothashes": [hashes[0]]})
    assert r.status_code == 409


# ---------------------------------------------------------------------------
# List / Get
# ---------------------------------------------------------------------------

def test_list_stacks_empty(client):
    r = client.get("/stacks")
    assert r.status_code == 200
    assert r.json() == []


def test_list_stacks_returns_all(client, db, default_kind_id):
    hashes1 = _make_photos(db, default_kind_id, 2)
    hashes2 = _make_photos(db, default_kind_id, 2)
    _create_stack(client, hashes1)
    _create_stack(client, hashes2)
    r = client.get("/stacks")
    assert r.status_code == 200
    assert len(r.json()) == 2


def test_get_stack_returns_photos(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 3)
    stack = _create_stack(client, hashes)
    r = client.get(f"/stacks/{stack['id']}")
    assert r.status_code == 200
    data = r.json()
    assert len(data["photos"]) == 3


def test_get_stack_not_found(client):
    r = client.get(f"/stacks/{uuid.uuid4()}")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Patch kind
# ---------------------------------------------------------------------------

def test_patch_kind(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 2)
    stack = _create_stack(client, hashes)
    r = client.patch(f"/stacks/{stack['id']}", json={"kind": "burst"})
    assert r.status_code == 200
    assert r.json()["kind"] == "burst"


def test_patch_invalid_kind_returns_422(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 2)
    stack = _create_stack(client, hashes)
    r = client.patch(f"/stacks/{stack['id']}", json={"kind": "invalid"})
    assert r.status_code == 422


# ---------------------------------------------------------------------------
# Add / remove photos
# ---------------------------------------------------------------------------

def test_add_photo_to_stack(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 2)
    extra = _make_photo(db, default_kind_id)
    stack = _create_stack(client, hashes)
    r = client.post(f"/stacks/{stack['id']}/photos/{extra}")
    assert r.status_code == 200
    assert r.json()["photo_count"] == 3


def test_add_photo_already_in_other_stack_returns_409(client, db, default_kind_id):
    h1, h2, h3 = _make_photos(db, default_kind_id, 3)
    stack1 = _create_stack(client, [h1, h2])
    _create_stack(client, [h3])
    r = client.post(f"/stacks/{stack1['id']}/photos/{h3}")
    assert r.status_code == 409


def test_remove_photo_from_stack(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 3)
    stack = _create_stack(client, hashes)
    r = client.delete(f"/stacks/{stack['id']}/photos/{hashes[2]}")
    assert r.status_code == 204
    r2 = client.get(f"/stacks/{stack['id']}")
    assert len(r2.json()["photos"]) == 2


def test_remove_cover_reassigns_cover(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 2)
    stack = _create_stack(client, hashes)
    r = client.delete(f"/stacks/{stack['id']}/photos/{hashes[0]}")
    assert r.status_code == 204
    r2 = client.get(f"/stacks/{stack['id']}")
    photos = r2.json()["photos"]
    assert any(p["is_stack_cover"] for p in photos)


def test_remove_last_photo_deletes_stack(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 1)
    stack = _create_stack(client, hashes)
    r = client.delete(f"/stacks/{stack['id']}/photos/{hashes[0]}")
    assert r.status_code == 204
    r2 = client.get(f"/stacks/{stack['id']}")
    assert r2.status_code == 404


# ---------------------------------------------------------------------------
# Set cover
# ---------------------------------------------------------------------------

def test_set_cover(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 3)
    stack = _create_stack(client, hashes)
    r = client.put(f"/stacks/{stack['id']}/cover/{hashes[2]}")
    assert r.status_code == 200
    assert r.json()["cover_hothash"] == hashes[2]


def test_set_cover_not_in_stack_returns_404(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 2)
    extra = _make_photo(db, default_kind_id)
    stack = _create_stack(client, hashes)
    r = client.put(f"/stacks/{stack['id']}/cover/{extra}")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Delete stack
# ---------------------------------------------------------------------------

def test_delete_stack(client, db, default_kind_id):
    hashes = _make_photos(db, default_kind_id, 2)
    stack = _create_stack(client, hashes)
    r = client.delete(f"/stacks/{stack['id']}")
    assert r.status_code == 204
    r2 = client.get(f"/stacks/{stack['id']}")
    assert r2.status_code == 404


def test_delete_stack_nullifies_photo_stack_id(client, db, default_kind_id):
    from models.photo import Photo

    hashes = _make_photos(db, default_kind_id, 2)
    stack = _create_stack(client, hashes)
    client.delete(f"/stacks/{stack['id']}")

    db.expire_all()
    for hothash in hashes:
        photo = db.query(Photo).filter(Photo.hothash == hothash).first()
        assert photo.stack_id is None
        assert photo.is_stack_cover is False
