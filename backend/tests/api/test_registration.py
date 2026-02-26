"""End-to-end registration flow tests."""

import shutil

import pytest

from core.config import settings as app_settings


@pytest.fixture(autouse=True)
def coldpreview_dir(tmp_path):
    """Redirect coldpreview output to a temp directory for each test."""
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


def _create_session(client, photographer_id, source_path, event_id=None):
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


def test_create_session(client, tmp_path):
    photographer_id = _create_photographer(client)
    r = client.post("/input-sessions", json={
        "name": "My Session",
        "source_path": str(tmp_path),
        "default_photographer_id": photographer_id,
    })
    assert r.status_code == 201
    data = r.json()
    assert data["status"] == "pending"
    assert data["photo_count"] == 0


def test_create_session_invalid_photographer(client, tmp_path):
    r = client.post("/input-sessions", json={
        "name": "Bad",
        "source_path": str(tmp_path),
        "default_photographer_id": "00000000-0000-0000-0000-000000000000",
    })
    assert r.status_code == 404


def test_scan_empty_directory(client, tmp_path):
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(tmp_path))
    r = client.post(f"/input-sessions/{session_id}/scan")
    assert r.status_code == 200
    summary = r.json()
    assert summary["total_groups"] == 0


def test_full_registration_flow(client, tmp_path, sample_image_path):
    """Create session, scan, process, verify photo and ImageFile are created."""
    photographer_id = _create_photographer(client)

    source_dir = tmp_path / "photos"
    source_dir.mkdir()
    shutil.copy(sample_image_path, source_dir / "test.jpg")

    session_id = _create_session(client, photographer_id, str(source_dir))

    # Scan
    r = client.post(f"/input-sessions/{session_id}/scan")
    assert r.status_code == 200
    summary = r.json()
    assert summary["total_groups"] == 1
    assert summary["jpeg_only"] == 1
    assert summary["already_registered"] == 0

    # Process
    r = client.post(f"/input-sessions/{session_id}/process")
    assert r.status_code == 200
    result = r.json()
    assert result["registered"] == 1
    assert result["duplicates"] == 0
    assert result["errors"] == 0

    # Session updated
    r = client.get(f"/input-sessions/{session_id}")
    assert r.json()["status"] == "completed"
    assert r.json()["photo_count"] == 1

    # Photo is in the list
    photos = client.get("/photos").json()
    assert len(photos) == 1
    hothash = photos[0]["hothash"]
    assert photos[0]["photographer_id"] == photographer_id

    # Photo detail
    detail = client.get(f"/photos/{hothash}").json()
    assert detail["coldpreview_path"] is not None
    assert detail["input_session_id"] == session_id

    # ImageFile registered
    files = client.get(f"/photos/{hothash}/files").json()
    assert len(files) == 1
    assert files[0]["is_master"] is True
    assert files[0]["file_type"] == "JPEG"

    # Session photos endpoint
    session_photos = client.get(f"/input-sessions/{session_id}/photos").json()
    assert len(session_photos) == 1
    assert session_photos[0]["hothash"] == hothash


def test_process_skips_already_registered(client, tmp_path, sample_image_path):
    """Re-running process on same directory skips already-registered files."""
    photographer_id = _create_photographer(client)
    source_dir = tmp_path / "photos"
    source_dir.mkdir()
    shutil.copy(sample_image_path, source_dir / "test.jpg")

    session_id = _create_session(client, photographer_id, str(source_dir))
    client.post(f"/input-sessions/{session_id}/process")

    # Second process run
    r = client.post(f"/input-sessions/{session_id}/process")
    assert r.status_code == 200
    result = r.json()
    assert result["registered"] == 0


def test_duplicate_detection_by_hothash(client, tmp_path, sample_image_path):
    """Same image content at two different paths → duplicate, not a new photo."""
    photographer_id = _create_photographer(client)

    dir1 = tmp_path / "dir1"
    dir1.mkdir()
    dir2 = tmp_path / "dir2"
    dir2.mkdir()

    shutil.copy(sample_image_path, dir1 / "image.jpg")
    shutil.copy(sample_image_path, dir2 / "image.jpg")  # identical content

    session1 = _create_session(client, photographer_id, str(dir1))
    client.post(f"/input-sessions/{session1}/process")

    session2 = _create_session(client, photographer_id, str(dir2))
    r = client.post(f"/input-sessions/{session2}/process")
    result = r.json()
    assert result["registered"] == 0
    assert result["duplicates"] == 1

    # Still only one photo in the system
    assert len(client.get("/photos").json()) == 1


def test_registration_with_event(client, tmp_path, sample_image_path):
    """Photos registered with an event get event_id set."""
    photographer_id = _create_photographer(client)
    event = client.post("/events", json={"name": "Summer Trip"}).json()

    source_dir = tmp_path / "photos"
    source_dir.mkdir()
    shutil.copy(sample_image_path, source_dir / "vacation.jpg")

    session_id = _create_session(client, photographer_id, str(source_dir), event_id=event["id"])
    client.post(f"/input-sessions/{session_id}/process")

    photos = client.get("/photos").json()
    assert photos[0]["event_id"] == event["id"]


def test_scan_counts_unknown_files(client, tmp_path):
    photographer_id = _create_photographer(client)
    (tmp_path / "readme.txt").write_text("hello")
    (tmp_path / "photo.jpg").write_bytes(b"\xff\xd8\xff")  # minimal JPEG marker

    session_id = _create_session(client, photographer_id, str(tmp_path))
    summary = client.post(f"/input-sessions/{session_id}/scan").json()
    assert summary["unknown_files"] == 1
