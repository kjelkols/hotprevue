"""Integration tests with real camera images.

Requires downloaded test images:
    make download-test-images

Run with:
    uv run pytest --real-images
"""

import base64
import hashlib
import tempfile
from pathlib import Path

import pytest

from core.config import settings as app_settings
from utils.exif import extract_camera_fields, extract_exif, extract_gps, extract_taken_at
from utils.previews import generate_coldpreview, generate_hotpreview, hotpreview_b64
from utils.quality import compute_quality_metrics
from utils.registration import file_type_from_suffix


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


def _build_group_payload(master_path: Path, companions: list[Path] | None = None) -> dict:
    """Process an image file as the client would, returning a GroupPayload dict."""
    master_str = str(master_path)

    jpeg_bytes, hothash, width, height = generate_hotpreview(master_str)

    with tempfile.TemporaryDirectory() as tmp:
        cold_path = generate_coldpreview(master_str, hothash, tmp)
        cold_b64 = base64.b64encode(Path(cold_path).read_bytes()).decode("ascii")

    exif = extract_exif(master_str)
    cam = extract_camera_fields(master_str)
    taken_at_dt = extract_taken_at(exif)
    gps_lat, gps_lng = extract_gps(exif)
    quality = compute_quality_metrics(master_str)

    master_data = master_path.read_bytes()

    companion_payloads = []
    for comp_path in (companions or []):
        comp_data = comp_path.read_bytes()
        companion_payloads.append({
            "path": str(comp_path),
            "type": file_type_from_suffix(comp_path.suffix.lower()),
            "file_size_bytes": len(comp_data),
            "file_content_hash": hashlib.sha256(comp_data).hexdigest(),
            "exif_data": extract_exif(str(comp_path)),
        })

    return {
        "hothash": hothash,
        "hotpreview_b64": hotpreview_b64(jpeg_bytes),
        "coldpreview_b64": cold_b64,
        "master_path": master_str,
        "master_type": file_type_from_suffix(master_path.suffix.lower()),
        "master_size_bytes": len(master_data),
        "master_content_hash": hashlib.sha256(master_data).hexdigest(),
        "master_exif": exif,
        "width": width,
        "height": height,
        "taken_at": taken_at_dt.isoformat() if taken_at_dt else None,
        "location_lat": gps_lat,
        "location_lng": gps_lng,
        "camera_make": cam.get("camera_make"),
        "camera_model": cam.get("camera_model"),
        "lens_model": cam.get("lens_model"),
        "iso": cam.get("iso"),
        "shutter_speed": cam.get("shutter_speed"),
        "aperture": cam.get("aperture"),
        "focal_length": cam.get("focal_length"),
        "sharpness_score": quality["sharpness_score"],
        "exposure_mean": quality["exposure_mean"],
        "exposure_clipping": quality["exposure_clipping"],
        "noise_score": quality["noise_score"],
        "companions": companion_payloads,
    }


def _register(client, session_id: str, master_path: Path, companions: list[Path] | None = None):
    payload = _build_group_payload(master_path, companions)
    return client.post(f"/input-sessions/{session_id}/groups", json=payload)


# ---------------------------------------------------------------------------
# JPEG-only registration
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_register_jpeg_only(client, real_image_dir):
    """Registering a standalone JPEG succeeds."""
    jpeg = real_image_dir / "nikon_d800.JPG"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, jpeg)
    assert r.status_code == 201, r.text
    data = r.json()
    assert data["status"] == "registered"
    assert len(data["hothash"]) == 64


# ---------------------------------------------------------------------------
# RAW-first: NEF as master, JPEG as companion
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_raw_is_master_when_both_present(client, real_image_dir):
    """When registering a NEF+JPEG pair, RAW must be master."""
    nef = real_image_dir / "nikon_d800.NEF"
    jpeg = real_image_dir / "nikon_d800.JPG"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, nef, companions=[jpeg])
    assert r.status_code == 201, r.text
    hothash = r.json()["hothash"]

    files = client.get(f"/photos/{hothash}/files").json()
    file_types = {f["file_type"] for f in files}
    assert "RAW" in file_types
    assert "JPEG" in file_types

    master = next(f for f in files if f["is_master"])
    assert master["file_type"] == "RAW"


@pytest.mark.real_images
def test_register_nef_standalone(client, real_image_dir):
    """Registering a NEF without any JPEG companion works."""
    nef = real_image_dir / "nikon_d800.NEF"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, nef)
    assert r.status_code == 201, r.text
    assert r.json()["status"] == "registered"


# ---------------------------------------------------------------------------
# EXIF — now stored per ImageFile, not on Photo
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_exif_stored_on_master_imagefile(client, real_image_dir):
    """After registration, EXIF is in image_files[master].exif_data."""
    nef = real_image_dir / "nikon_d800.NEF"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, nef)
    hothash = r.json()["hothash"]

    files = client.get(f"/photos/{hothash}/files").json()
    master = next(f for f in files if f["is_master"])
    assert master["exif_data"], "Master ImageFile has no exif_data"
    assert "date_time_original" in master["exif_data"]


@pytest.mark.real_images
def test_exif_stored_on_jpeg_companion(client, real_image_dir):
    """JPEG companion also gets its own exif_data."""
    nef = real_image_dir / "nikon_d800.NEF"
    jpeg = real_image_dir / "nikon_d800.JPG"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, nef, companions=[jpeg])
    hothash = r.json()["hothash"]

    files = client.get(f"/photos/{hothash}/files").json()
    companion = next(f for f in files if not f["is_master"])
    assert companion["exif_data"], "JPEG companion has no exif_data"


@pytest.mark.real_images
def test_photo_canonical_fields_populated(client, real_image_dir):
    """taken_at and camera_make/model are derived from master EXIF."""
    nef = real_image_dir / "nikon_d800.NEF"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, nef)
    hothash = r.json()["hothash"]

    detail = client.get(f"/photos/{hothash}").json()
    assert detail["taken_at"] is not None, "taken_at not set"
    assert detail["camera_make"], "camera_make not set"
    assert detail["camera_model"], "camera_model not set"
    assert "nikon" in detail["camera_make"].lower()


@pytest.mark.real_images
def test_photo_dimensions_populated(client, real_image_dir):
    """photo.width and photo.height are populated from actual RAW sensor size."""
    nef = real_image_dir / "nikon_d800.NEF"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, nef)
    hothash = r.json()["hothash"]

    detail = client.get(f"/photos/{hothash}").json()
    # D800 is a 36MP camera; dimensions must be far larger than the hotpreview
    assert detail["width"] is not None and detail["width"] > 3000
    assert detail["height"] is not None and detail["height"] > 2000


# ---------------------------------------------------------------------------
# File metadata
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_file_size_bytes_populated(client, real_image_dir):
    """ImageFile.file_size_bytes is set for both master and companion."""
    nef = real_image_dir / "nikon_d800.NEF"
    jpeg = real_image_dir / "nikon_d800.JPG"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, nef, companions=[jpeg])
    hothash = r.json()["hothash"]

    files = client.get(f"/photos/{hothash}/files").json()
    for f in files:
        assert f["file_size_bytes"] is not None, f"{f['file_type']} has no file_size_bytes"
        assert f["file_size_bytes"] > 0


@pytest.mark.real_images
def test_file_content_hash_populated(client, real_image_dir):
    """ImageFile.file_content_hash (SHA256) is set for both master and companion."""
    nef = real_image_dir / "nikon_d800.NEF"
    jpeg = real_image_dir / "nikon_d800.JPG"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, nef, companions=[jpeg])
    hothash = r.json()["hothash"]

    files = client.get(f"/photos/{hothash}/files").json()
    for f in files:
        assert f["file_content_hash"] is not None, f"{f['file_type']} has no file_content_hash"
        assert len(f["file_content_hash"]) == 64, "SHA256 hex must be 64 chars"


@pytest.mark.real_images
def test_file_content_hash_differs_between_nef_and_jpeg(client, real_image_dir):
    """NEF and JPEG are different files — their file_content_hash must differ."""
    nef = real_image_dir / "nikon_d800.NEF"
    jpeg = real_image_dir / "nikon_d800.JPG"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, nef, companions=[jpeg])
    hothash = r.json()["hothash"]

    files = client.get(f"/photos/{hothash}/files").json()
    hashes = [f["file_content_hash"] for f in files]
    assert len(set(hashes)) == len(hashes), "Each file must have a unique file_content_hash"


# ---------------------------------------------------------------------------
# Previews
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_coldpreview_served_for_nef(client, real_image_dir):
    """Coldpreview endpoint returns a JPEG for an NEF-master photo."""
    nef = real_image_dir / "nikon_d800.NEF"
    photographer_id = _create_photographer(client)
    session_id = _create_session(client, photographer_id, str(real_image_dir))

    r = _register(client, session_id, nef)
    hothash = r.json()["hothash"]

    r = client.get(f"/photos/{hothash}/coldpreview")
    assert r.status_code == 200
    assert r.headers["content-type"] == "image/jpeg"
    assert len(r.content) > 0


# ---------------------------------------------------------------------------
# Duplicate detection
# ---------------------------------------------------------------------------

@pytest.mark.real_images
def test_nef_already_registered(client, real_image_dir):
    """Registering the same path twice → already_registered."""
    nef = real_image_dir / "nikon_d800.NEF"
    photographer_id = _create_photographer(client)

    session1 = _create_session(client, photographer_id, str(real_image_dir))
    r1 = _register(client, session1, nef)
    assert r1.status_code == 201, r1.text

    session2 = _create_session(client, photographer_id, str(real_image_dir))
    r2 = _register(client, session2, nef)
    assert r2.status_code == 200
    assert r2.json()["status"] == "already_registered"


@pytest.mark.real_images
def test_nef_duplicate_content(client, real_image_dir):
    """Same image content at a different path → duplicate."""
    nef = real_image_dir / "nikon_d800.NEF"
    photographer_id = _create_photographer(client)

    session1 = _create_session(client, photographer_id, str(real_image_dir))
    r1 = _register(client, session1, nef)
    assert r1.status_code == 201, r1.text

    session2 = _create_session(client, photographer_id, str(real_image_dir))
    payload = _build_group_payload(nef)
    payload["master_path"] = str(nef) + ".copy"  # Different path, same content
    r2 = client.post(f"/input-sessions/{session2}/groups", json=payload)
    assert r2.status_code == 200
    assert r2.json()["status"] == "duplicate"
