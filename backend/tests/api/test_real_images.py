"""Integrasjonstester med reelle kamerabilder.

Krever nedlastede testbilder:
    make download-test-images

Kjør med:
    make test-all
"""

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


def _create_photographer(client):
    r = client.post("/photographers", json={"name": "Test"})
    assert r.status_code == 201
    return r.json()["id"]


def _create_session(client, photographer_id, source_path):
    r = client.post("/input-sessions", json={
        "name": "Real images",
        "source_path": source_path,
        "default_photographer_id": photographer_id,
    })
    assert r.status_code == 201
    return r.json()["id"]


def _upload_group(client, session_id, master_path, companions=None):
    meta = {
        "master_path": str(master_path),
        "master_type": "JPEG",
        "companions": companions or [],
    }
    with open(master_path, "rb") as f:
        return client.post(
            f"/input-sessions/{session_id}/groups",
            files={"master_file": (master_path.name, f, "image/jpeg")},
            data={"metadata": json.dumps(meta)},
        )


# ---------------------------------------------------------------------------
# Registrering
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_register_real_jpeg(client, real_image_dir):
    """Registrering av JPEG-filen skal lykkes uten feil."""
    jpeg = real_image_dir / "nikon_d800.JPG"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _upload_group(client, session_id, jpeg)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "registered"
    assert data["hothash"]


@pytest.mark.real_images
def test_register_with_raw_companion(client, real_image_dir):
    """RAW-filen skal registreres som companion til JPEG-masteren."""
    jpeg = real_image_dir / "nikon_d800.JPG"
    nef = real_image_dir / "nikon_d800.NEF"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    companions = [{"path": str(nef), "type": "RAW"}]
    r = _upload_group(client, session_id, jpeg, companions=companions)
    assert r.status_code == 201
    hothash = r.json()["hothash"]

    files = client.get(f"/photos/{hothash}/files").json()
    file_types = {f["file_type"] for f in files}
    assert "JPEG" in file_types
    assert "RAW" in file_types

    masters = [f for f in files if f["is_master"]]
    assert len(masters) == 1
    assert masters[0]["file_type"] == "JPEG"


@pytest.mark.real_images
def test_exif_extracted(client, real_image_dir):
    """Registrert bilde skal ha EXIF-data og taken_at."""
    jpeg = real_image_dir / "nikon_d800.JPG"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _upload_group(client, session_id, jpeg)
    hothash = r.json()["hothash"]

    detail = client.get(f"/photos/{hothash}").json()
    assert detail["exif_data"], "Ingen EXIF-data"
    assert detail["taken_at"] is not None, "Mangler taken_at"
    assert detail["camera_make"]
    assert detail["camera_model"]


@pytest.mark.real_images
def test_coldpreview_served(client, real_image_dir):
    """Coldpreview-endepunktet skal returnere et JPEG etter registrering."""
    jpeg = real_image_dir / "nikon_d800.JPG"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _upload_group(client, session_id, jpeg)
    hothash = r.json()["hothash"]

    r = client.get(f"/photos/{hothash}/coldpreview")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert len(r.content) > 0


@pytest.mark.real_images
def test_duplicate_detection(client, real_image_dir):
    """Samme JPEG lastet opp to ganger → duplicate."""
    jpeg = real_image_dir / "nikon_d800.JPG"
    photographer_id = _create_photographer(client)

    session1 = _create_session(client, photographer_id, str(real_image_dir))
    r1 = _upload_group(client, session1, jpeg)
    assert r1.status_code == 201

    session2 = _create_session(client, photographer_id, "/backup/photos")
    # Same file content, different claimed path → duplicate (not already_registered)
    meta = {"master_path": "/backup/photos/nikon_d800.JPG", "master_type": "JPEG", "companions": []}
    with open(jpeg, "rb") as f:
        r2 = client.post(
            f"/input-sessions/{session2}/groups",
            files={"master_file": (jpeg.name, f, "image/jpeg")},
            data={"metadata": json.dumps(meta)},
        )
    assert r2.status_code == 200
    assert r2.json()["status"] == "duplicate"

    assert len(client.get("/photos").json()) == 1
