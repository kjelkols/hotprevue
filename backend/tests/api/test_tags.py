"""Tests for /tags endpoints."""
import uuid

import pytest


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _create(client, name: str) -> dict:
    r = client.post("/tags", json={"name": name})
    assert r.status_code == 201
    return r.json()


def _make_photo(db, kind_id) -> str:
    """Insert a minimal photo row and return its hothash."""
    import uuid as _uuid
    from models.photo import Photo
    from models.photographer import Photographer

    photographer = Photographer(name="Test")
    db.add(photographer)
    db.flush()

    hothash = _uuid.uuid4().hex
    photo = Photo(
        hothash=hothash,
        hotpreview_b64="",
        kind_id=kind_id,
        photographer_id=photographer.id,
    )
    db.add(photo)
    db.commit()
    return hothash


# ---------------------------------------------------------------------------
# CRUD
# ---------------------------------------------------------------------------

def test_list_tags_empty(client):
    r = client.get("/tags")
    assert r.status_code == 200
    assert r.json() == []


def test_create_tag(client):
    data = _create(client, "Portrett")
    assert data["name"] == "Portrett"
    assert data["slug"] == "portrett"
    assert data["photo_count"] == 0
    assert "id" in data


def test_create_tag_strips_and_lowercases_slug(client):
    data = _create(client, "  Natur  ")
    assert data["name"] == "Natur"
    assert data["slug"] == "natur"


def test_create_tag_slug_collision_returns_409(client):
    _create(client, "Sport")
    r = client.post("/tags", json={"name": "sport"})
    assert r.status_code == 409


def test_list_tags_returns_all(client):
    _create(client, "A")
    _create(client, "B")
    r = client.get("/tags")
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "A" in names
    assert "B" in names


def test_rename_tag(client):
    tag = _create(client, "Gammel")
    r = client.patch(f"/tags/{tag['id']}", json={"name": "Ny"})
    assert r.status_code == 200
    assert r.json()["name"] == "Ny"
    assert r.json()["slug"] == "ny"


def test_rename_tag_slug_collision_returns_409(client):
    _create(client, "Alpha")
    beta = _create(client, "Beta")
    r = client.patch(f"/tags/{beta['id']}", json={"name": "Alpha"})
    assert r.status_code == 409


def test_rename_tag_same_name_is_ok(client):
    tag = _create(client, "Uendret")
    r = client.patch(f"/tags/{tag['id']}", json={"name": "Uendret"})
    assert r.status_code == 200


def test_delete_tag(client):
    tag = _create(client, "Slett meg")
    assert client.delete(f"/tags/{tag['id']}").status_code == 204
    tags = client.get("/tags").json()
    assert not any(t["id"] == tag["id"] for t in tags)


def test_delete_nonexistent_returns_404(client):
    assert client.delete(f"/tags/{uuid.uuid4()}").status_code == 404


# ---------------------------------------------------------------------------
# Batch add / remove
# ---------------------------------------------------------------------------

def test_add_tag_to_photos(client, db, default_kind_id):
    tag = _create(client, "Natur")
    p1 = _make_photo(db, default_kind_id)
    p2 = _make_photo(db, default_kind_id)

    r = client.post(f"/tags/{tag['id']}/add-to-photos", json={"hothashes": [p1, p2]})
    assert r.status_code == 200
    assert r.json()["added"] == 2


def test_add_tag_to_photos_idempotent(client, db, default_kind_id):
    tag = _create(client, "Idempotent")
    p = _make_photo(db, default_kind_id)

    client.post(f"/tags/{tag['id']}/add-to-photos", json={"hothashes": [p]})
    r = client.post(f"/tags/{tag['id']}/add-to-photos", json={"hothashes": [p]})
    assert r.status_code == 200
    assert r.json()["added"] == 0


def test_remove_tag_from_photos(client, db, default_kind_id):
    tag = _create(client, "Fjernes")
    p = _make_photo(db, default_kind_id)

    client.post(f"/tags/{tag['id']}/add-to-photos", json={"hothashes": [p]})
    r = client.post(f"/tags/{tag['id']}/remove-from-photos", json={"hothashes": [p]})
    assert r.status_code == 200
    assert r.json()["removed"] == 1


def test_photo_count_reflects_assignments(client, db, default_kind_id):
    tag = _create(client, "Teller")
    p1 = _make_photo(db, default_kind_id)
    p2 = _make_photo(db, default_kind_id)

    client.post(f"/tags/{tag['id']}/add-to-photos", json={"hothashes": [p1, p2]})

    tags = client.get("/tags").json()
    entry = next(t for t in tags if t["id"] == tag["id"])
    assert entry["photo_count"] == 2


# ---------------------------------------------------------------------------
# Merge
# ---------------------------------------------------------------------------

def test_merge_moves_photos_to_target(client, db, default_kind_id):
    source = _create(client, "Portrett")
    target = _create(client, "Portretter")
    p1 = _make_photo(db, default_kind_id)
    p2 = _make_photo(db, default_kind_id)

    client.post(f"/tags/{source['id']}/add-to-photos", json={"hothashes": [p1]})
    client.post(f"/tags/{target['id']}/add-to-photos", json={"hothashes": [p2]})

    r = client.post(f"/tags/{source['id']}/merge-into/{target['id']}")
    assert r.status_code == 200
    result = r.json()
    assert result["target"]["id"] == target["id"]
    assert result["merged_photo_count"] == 2


def test_merge_deletes_source_tag(client, db, default_kind_id):
    source = _create(client, "Kilde")
    target = _create(client, "Mål")

    client.post(f"/tags/{source['id']}/merge-into/{target['id']}")

    tags = client.get("/tags").json()
    assert not any(t["id"] == source["id"] for t in tags)


def test_merge_handles_overlap(client, db, default_kind_id):
    """Et bilde som har begge tags skal ende opp med kun target etter merge."""
    source = _create(client, "Dup1")
    target = _create(client, "Dup2")
    p = _make_photo(db, default_kind_id)

    client.post(f"/tags/{source['id']}/add-to-photos", json={"hothashes": [p]})
    client.post(f"/tags/{target['id']}/add-to-photos", json={"hothashes": [p]})

    r = client.post(f"/tags/{source['id']}/merge-into/{target['id']}")
    assert r.status_code == 200
    assert r.json()["merged_photo_count"] == 1


def test_merge_same_tag_returns_400(client):
    tag = _create(client, "Seg selv")
    r = client.post(f"/tags/{tag['id']}/merge-into/{tag['id']}")
    assert r.status_code == 400


def test_merge_nonexistent_source_returns_404(client):
    target = _create(client, "Mål")
    r = client.post(f"/tags/{uuid.uuid4()}/merge-into/{target['id']}")
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Similar (pg_trgm)
# ---------------------------------------------------------------------------

def test_similar_returns_close_matches(client):
    _create(client, "portrett")
    _create(client, "portrettfoto")
    _create(client, "natur")

    r = client.get("/tags/similar", params={"name": "portret"})
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "portrett" in names


def test_similar_excludes_unrelated(client):
    _create(client, "natur")

    r = client.get("/tags/similar", params={"name": "portrett"})
    assert r.status_code == 200
    names = [t["name"] for t in r.json()]
    assert "natur" not in names
