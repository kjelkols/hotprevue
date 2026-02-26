"""Tests for GET/POST/PATCH/DELETE /photographers."""


def test_create_photographer(client):
    r = client.post("/photographers", json={"name": "Alice"})
    assert r.status_code == 201
    data = r.json()
    assert data["name"] == "Alice"
    assert data["is_default"] is False
    assert data["is_unknown"] is False
    assert "id" in data
    assert "created_at" in data


def test_list_photographers_empty(client):
    r = client.get("/photographers")
    assert r.status_code == 200
    assert r.json() == []


def test_list_photographers_sorted_by_name(client):
    client.post("/photographers", json={"name": "Bob"})
    client.post("/photographers", json={"name": "Alice"})
    r = client.get("/photographers")
    names = [p["name"] for p in r.json()]
    assert names == ["Alice", "Bob"]


def test_get_photographer(client):
    created = client.post("/photographers", json={"name": "Carol"}).json()
    r = client.get(f"/photographers/{created['id']}")
    assert r.status_code == 200
    assert r.json()["name"] == "Carol"


def test_get_photographer_not_found(client):
    r = client.get("/photographers/00000000-0000-0000-0000-000000000000")
    assert r.status_code == 404


def test_patch_photographer(client):
    created = client.post("/photographers", json={"name": "Dave"}).json()
    r = client.patch(
        f"/photographers/{created['id']}",
        json={"name": "David", "website": "https://example.com"},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "David"
    assert data["website"] == "https://example.com"


def test_delete_photographer(client):
    created = client.post("/photographers", json={"name": "Temp"}).json()
    r = client.delete(f"/photographers/{created['id']}")
    assert r.status_code == 204
    assert client.get(f"/photographers/{created['id']}").status_code == 404


def test_delete_photographer_with_photos_fails(client, db, sample_image_path):
    """Cannot delete a photographer that has photos."""
    from models.photo import Photo
    from utils.previews import generate_hotpreview, hotpreview_b64

    p = client.post("/photographers", json={"name": "WithPhotos"}).json()
    import uuid
    photographer_id = uuid.UUID(p["id"])

    jpeg_bytes, hothash = generate_hotpreview(sample_image_path)
    db.add(Photo(
        hothash=hothash,
        hotpreview_b64=hotpreview_b64(jpeg_bytes),
        photographer_id=photographer_id,
        exif_data={},
    ))
    db.commit()

    r = client.delete(f"/photographers/{photographer_id}")
    assert r.status_code == 409
