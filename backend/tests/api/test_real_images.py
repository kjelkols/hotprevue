"""Integrasjonstester med reelle kamerabilder.

Krever nedlastede testbilder:
    make download-test-images

Kjør med:
    make test-all
"""

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


def _create_photographer(client):
    r = client.post("/photographers", json={"name": "Test"})
    assert r.status_code == 201
    return r.json()["id"]


# ---------------------------------------------------------------------------
# Scan
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_scan_finds_files(client, real_image_dir):
    """Scan skal finne filene i .test-images/."""
    photographer_id = _create_photographer(client)
    r = client.post("/input-sessions", json={
        "name": "Real images",
        "source_path": str(real_image_dir),
        "default_photographer_id": photographer_id,
    })
    assert r.status_code == 201
    session_id = r.json()["id"]

    summary = client.post(f"/input-sessions/{session_id}/scan").json()
    assert summary["total_groups"] >= 1


@pytest.mark.real_images
def test_scan_detects_raw_jpeg_pair(client, real_image_dir):
    """Et RAW+JPEG-par med samme filnavn skal grupperes som én gruppe."""
    photographer_id = _create_photographer(client)
    r = client.post("/input-sessions", json={
        "name": "Real images",
        "source_path": str(real_image_dir),
        "default_photographer_id": photographer_id,
    })
    session_id = r.json()["id"]

    summary = client.post(f"/input-sessions/{session_id}/scan").json()
    assert summary["raw_jpeg_pairs"] >= 1, "Forventet minst ett RAW+JPEG-par"


# ---------------------------------------------------------------------------
# Registrering
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_process_registers_photos(client, real_image_dir):
    """Alle bildegrupper skal registreres uten feil."""
    photographer_id = _create_photographer(client)
    r = client.post("/input-sessions", json={
        "name": "Real images",
        "source_path": str(real_image_dir),
        "default_photographer_id": photographer_id,
    })
    session_id = r.json()["id"]
    client.post(f"/input-sessions/{session_id}/scan")

    result = client.post(f"/input-sessions/{session_id}/process").json()
    if result["errors"]:
        errors = client.get(f"/input-sessions/{session_id}/errors").json()
        pytest.fail(f"Registrering feilet: {errors}")
    assert result["registered"] >= 1


@pytest.mark.real_images
def test_companion_files_registered(client, real_image_dir):
    """RAW-filen skal registreres som companion til JPEG-masteren."""
    photographer_id = _create_photographer(client)
    r = client.post("/input-sessions", json={
        "name": "Real images",
        "source_path": str(real_image_dir),
        "default_photographer_id": photographer_id,
    })
    session_id = r.json()["id"]
    client.post(f"/input-sessions/{session_id}/process")

    photos = client.get("/photos").json()
    assert len(photos) >= 1

    hothash = photos[0]["hothash"]
    files = client.get(f"/photos/{hothash}/files").json()

    file_types = {f["file_type"] for f in files}
    assert "JPEG" in file_types
    assert "RAW" in file_types

    masters = [f for f in files if f["is_master"]]
    assert len(masters) == 1
    assert masters[0]["file_type"] == "JPEG"


# ---------------------------------------------------------------------------
# EXIF
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_exif_extracted(client, real_image_dir):
    """Registrerte bilder skal ha EXIF-data og taken_at."""
    photographer_id = _create_photographer(client)
    r = client.post("/input-sessions", json={
        "name": "Real images",
        "source_path": str(real_image_dir),
        "default_photographer_id": photographer_id,
    })
    session_id = r.json()["id"]
    client.post(f"/input-sessions/{session_id}/process")

    photos = client.get("/photos").json()
    hothash = photos[0]["hothash"]
    detail = client.get(f"/photos/{hothash}").json()

    assert detail["exif_data"], "Ingen EXIF-data"
    assert detail["taken_at"] is not None, "Mangler taken_at"


# ---------------------------------------------------------------------------
# Coldpreview
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_coldpreview_generated(client, real_image_dir):
    """Coldpreview-sti skal være satt etter registrering."""
    photographer_id = _create_photographer(client)
    r = client.post("/input-sessions", json={
        "name": "Real images",
        "source_path": str(real_image_dir),
        "default_photographer_id": photographer_id,
    })
    session_id = r.json()["id"]
    client.post(f"/input-sessions/{session_id}/process")

    photos = client.get("/photos").json()
    hothash = photos[0]["hothash"]
    detail = client.get(f"/photos/{hothash}").json()

    assert detail["coldpreview_path"] is not None
