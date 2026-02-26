"""End-to-end registration flow tests."""

import json

import pytest

from core.config import settings as app_settings


@pytest.fixture(autouse=True)
def coldpreview_dir(tmp_path):
    original = app_settings.coldpreview_dir
    coldpreview_test = tmp_path / "coldpreviews"
    coldpreview_test.mkdir()
    app_settings.coldpreview_dir = str(coldpreview_test)
    yield str(coldpreview_test)
    app_settings.coldpreview_dir = original


def _create_photographer(client, name="Test Photographer"):
    r = client.post("/photographers", json={"name": name})
    assert r.status_code == 201
    return r.json()["id"]


def _create_session(client, photographer_id, source_path="/photos", event_id=None):
    payload = {
        "name": "Test Session",
        "source_path": source_path,
        "default_photographer_id": photographer_id,
    }
    if event_id:
        payload["default_event_id"] = event_id
    r = client.post("/input-sessions", json=payload)
    assert r.status_code == 201
    return r.json()["id"]


def _upload_group(client, session_id, image_path, master_path=None, companions=None):
    """Upload a single file group. master_path defaults to image_path."""
    if master_path is None:
        master_path = image_path
    meta = {
        "master_path": master_path,
        "master_type": "JPEG",
        "companions": companions or [],
    }
    with open(image_path, "rb") as f:
        r = client.post(
            f"/input-sessions/{session_id}/groups",
            files={"master_file": ("image.jpg", f, "image/jpeg")},
            data={"metadata": json.dumps(meta)},
        )
    return r


# ---------------------------------------------------------------------------
# Session creation
# ---------------------------------------------------------------------------

def test_create_session(client):
    photographer_id = _create_photographer(client)
    r = client.post("/input-sessions", json={
        "name": "My Session",
        "source_path": "/Users/kjell/Photos",
        "default_photographer_id": photographer_id,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "pending"
    assert data["photo_count"] == 0
    assert data["source_path"] == "/Users/kjell/Photos"


def test_create_session_invalid_photographer(client):
    r = client.post("/input-sessions", json={
        "name": "Bad",
        "source_path": "/photos",
        "default_photographer_id": "00000000-0000-0000-0000-000000000000",
    })
    assert r.status_code == 404


# ---------------------------------------------------------------------------
# Check
# ---------------------------------------------------------------------------

def test_check_all_unknown(client, sample_image_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)

    r = client.post(f"/input-sessions/{session_id}/check", json={
        "master_paths": ["/photos/a.jpg", "/photos/b.jpg"],
    })
    assert r.status_code == 200
    data = r.json()
    assert data["known"] == []
    assert set(data["unknown"]) == {"/photos/a.jpg", "/photos/b.jpg"}


def test_check_detects_known_path(client, sample_image_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)
    _upload_group(client, session_id, sample_image_path, master_path="/photos/a.jpg")

    r = client.post(f"/input-sessions/{session_id}/check", json={
        "master_paths": ["/photos/a.jpg", "/photos/b.jpg"],
    })
    assert r.status_code == 200
    data = r.json()
    assert data["known"] == ["/photos/a.jpg"]
    assert data["unknown"] == ["/photos/b.jpg"]


# ---------------------------------------------------------------------------
# Register group
# ---------------------------------------------------------------------------

def test_register_group_basic(client, sample_image_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)

    r = _upload_group(client, session_id, sample_image_path, master_path="/photos/img.jpg")
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "registered"
    assert data["hothash"]
    assert data["photo_id"]

    photos = client.get("/photos").json()
    assert len(photos) == 1
    assert photos[0]["photographer_id"] == photographer_id


def test_register_group_already_registered(client, sample_image_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)

    _upload_group(client, session_id, sample_image_path, master_path="/photos/img.jpg")

    r = _upload_group(client, session_id, sample_image_path, master_path="/photos/img.jpg")
    assert r.status_code == 200
    assert r.json()["status"] == "already_registered"

    assert len(client.get("/photos").json()) == 1


def test_register_group_duplicate_content(client, sample_image_path):
    """Same image content at two different paths → duplicate."""
    photographer_id = _create_photographer(client)
    session1 = _create_session(client, photographer_id)
    session2 = _create_session(client, photographer_id)

    _upload_group(client, session1, sample_image_path, master_path="/dir1/img.jpg")

    r = _upload_group(client, session2, sample_image_path, master_path="/dir2/img.jpg")
    assert r.status_code == 200
    assert r.json()["status"] == "duplicate"

    assert len(client.get("/photos").json()) == 1


def test_register_group_with_companions(client, sample_image_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)

    companions = [{"path": "/photos/img.NEF", "type": "RAW"}]
    r = _upload_group(
        client, session_id, sample_image_path,
        master_path="/photos/img.jpg",
        companions=companions,
    )
    assert r.status_code == 201
    hothash = r.json()["hothash"]

    files = client.get(f"/photos/{hothash}/files").json()
    assert len(files) == 2
    file_types = {f["file_type"] for f in files}
    assert "JPEG" in file_types
    assert "RAW" in file_types
    masters = [f for f in files if f["is_master"]]
    assert len(masters) == 1
    assert masters[0]["file_type"] == "JPEG"


def test_register_group_with_event(client, sample_image_path):
    photographer_id = _create_photographer(client)
    event = client.post("/events", json={"name": "Summer Trip"}).json()
    session_id = _create_session(client, photographer_id, event_id=event["id"])

    _upload_group(client, session_id, sample_image_path, master_path="/photos/img.jpg")

    photos = client.get("/photos").json()
    assert photos[0]["event_id"] == event["id"]


def test_register_group_status_becomes_uploading(client, sample_image_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)

    assert client.get(f"/input-sessions/{session_id}").json()["status"] == "pending"
    _upload_group(client, session_id, sample_image_path, master_path="/photos/img.jpg")
    assert client.get(f"/input-sessions/{session_id}").json()["status"] == "uploading"


# ---------------------------------------------------------------------------
# Complete
# ---------------------------------------------------------------------------

def test_complete_session(client, sample_image_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)

    _upload_group(client, session_id, sample_image_path, master_path="/photos/img.jpg")

    r = client.post(f"/input-sessions/{session_id}/complete")
    assert r.status_code == 200
    result = r.json()
    assert result["registered"] == 1
    assert result["duplicates"] == 0
    assert result["errors"] == 0

    assert client.get(f"/input-sessions/{session_id}").json()["status"] == "completed"


def test_complete_is_idempotent(client, sample_image_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)
    _upload_group(client, session_id, sample_image_path, master_path="/photos/img.jpg")

    r1 = client.post(f"/input-sessions/{session_id}/complete").json()
    r2 = client.post(f"/input-sessions/{session_id}/complete").json()
    assert r1 == r2


# ---------------------------------------------------------------------------
# Photo companion and reprocess
# ---------------------------------------------------------------------------

def test_add_companion(client, sample_image_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)
    r = _upload_group(client, session_id, sample_image_path, master_path="/photos/img.jpg")
    hothash = r.json()["hothash"]

    r = client.post(f"/photos/{hothash}/companions", json={
        "path": "/photos/img.NEF",
        "type": "RAW",
    })
    assert r.status_code == 201
    assert r.json()["file_type"] == "RAW"
    assert r.json()["is_master"] is False

    files = client.get(f"/photos/{hothash}/files").json()
    assert len(files) == 2


def test_add_companion_duplicate_path(client, sample_image_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)
    r = _upload_group(client, session_id, sample_image_path, master_path="/photos/img.jpg")
    hothash = r.json()["hothash"]

    client.post(f"/photos/{hothash}/companions", json={"path": "/photos/img.NEF", "type": "RAW"})
    r = client.post(f"/photos/{hothash}/companions", json={"path": "/photos/img.NEF", "type": "RAW"})
    assert r.status_code == 409


def test_reprocess_regenerates_coldpreview(client, sample_image_path, coldpreview_dir):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id)
    r = _upload_group(client, session_id, sample_image_path, master_path="/photos/img.jpg")
    hothash = r.json()["hothash"]

    with open(sample_image_path, "rb") as f:
        r = client.post(
            f"/photos/{hothash}/reprocess",
            files={"master_file": ("img.jpg", f, "image/jpeg")},
        )
    assert r.status_code == 200
    assert r.json()["coldpreview_path"]
