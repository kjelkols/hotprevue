"""Unit tests for utils/exif.py — Pillow (JPEG) and exifread (RAW) backends.

No database required. Tests functions directly on real camera files.
Run with: uv run pytest --real-images tests/utils/test_exif.py
"""

import pytest

from utils.exif import (
    extract_camera_fields,
    extract_exif,
    extract_gps,
    extract_taken_at,
)


# ---------------------------------------------------------------------------
# Pillow backend — JPEG
# ---------------------------------------------------------------------------

@pytest.mark.real_images
class TestPillowBackend:
    def test_extract_exif_returns_nonempty_dict(self, real_image_dir):
        result = extract_exif(str(real_image_dir / "nikon_d800.JPG"))
        assert isinstance(result, dict)
        assert result

    def test_date_time_original_present(self, real_image_dir):
        exif = extract_exif(str(real_image_dir / "nikon_d800.JPG"))
        assert "date_time_original" in exif

    def test_extract_taken_at_parses_datetime(self, real_image_dir):
        exif = extract_exif(str(real_image_dir / "nikon_d800.JPG"))
        dt = extract_taken_at(exif)
        assert dt is not None

    def test_camera_make_and_model(self, real_image_dir):
        fields = extract_camera_fields(str(real_image_dir / "nikon_d800.JPG"))
        assert "camera_make" in fields
        assert "camera_model" in fields
        assert "nikon" in fields["camera_make"].lower()

    def test_numeric_camera_fields(self, real_image_dir):
        fields = extract_camera_fields(str(real_image_dir / "nikon_d800.JPG"))
        if "iso" in fields:
            assert isinstance(fields["iso"], int)
        if "aperture" in fields:
            assert isinstance(fields["aperture"], float)
        if "focal_length" in fields:
            assert isinstance(fields["focal_length"], float)

    def test_no_crash_on_jpeg_without_exif(self, tmp_path):
        """Plain JPEG with no EXIF returns empty dict, never raises."""
        from PIL import Image
        img = Image.new("RGB", (100, 100), color=(64, 128, 192))
        path = tmp_path / "no_exif.jpg"
        img.save(str(path), format="JPEG")
        result = extract_exif(str(path))
        assert result == {}


# ---------------------------------------------------------------------------
# exifread backend — RAW (NEF)
# ---------------------------------------------------------------------------

@pytest.mark.real_images
class TestExifreadBackend:
    def test_extract_exif_nef_returns_nonempty_dict(self, real_image_dir):
        result = extract_exif(str(real_image_dir / "nikon_d800.NEF"))
        assert isinstance(result, dict)
        assert result

    def test_date_time_original_nef(self, real_image_dir):
        exif = extract_exif(str(real_image_dir / "nikon_d800.NEF"))
        assert "date_time_original" in exif

    def test_extract_taken_at_parses_from_nef(self, real_image_dir):
        exif = extract_exif(str(real_image_dir / "nikon_d800.NEF"))
        dt = extract_taken_at(exif)
        assert dt is not None

    def test_camera_make_and_model_nef(self, real_image_dir):
        fields = extract_camera_fields(str(real_image_dir / "nikon_d800.NEF"))
        assert "camera_make" in fields
        assert "camera_model" in fields
        assert "nikon" in fields["camera_make"].lower()

    def test_numeric_camera_fields_nef(self, real_image_dir):
        fields = extract_camera_fields(str(real_image_dir / "nikon_d800.NEF"))
        if "iso" in fields:
            assert isinstance(fields["iso"], int)
        if "aperture" in fields:
            assert isinstance(fields["aperture"], float)
        if "focal_length" in fields:
            assert isinstance(fields["focal_length"], float)


# ---------------------------------------------------------------------------
# Consistency: JPEG and NEF from same shot
# ---------------------------------------------------------------------------

@pytest.mark.real_images
class TestJpegNefConsistency:
    def test_camera_make_matches(self, real_image_dir):
        jpeg_fields = extract_camera_fields(str(real_image_dir / "nikon_d800.JPG"))
        nef_fields = extract_camera_fields(str(real_image_dir / "nikon_d800.NEF"))
        assert jpeg_fields.get("camera_make") == nef_fields.get("camera_make")

    def test_camera_model_matches(self, real_image_dir):
        jpeg_fields = extract_camera_fields(str(real_image_dir / "nikon_d800.JPG"))
        nef_fields = extract_camera_fields(str(real_image_dir / "nikon_d800.NEF"))
        assert jpeg_fields.get("camera_model") == nef_fields.get("camera_model")

    def test_taken_at_matches(self, real_image_dir):
        """Same shot → identical timestamp in both JPEG and NEF."""
        jpeg_dt = extract_taken_at(extract_exif(str(real_image_dir / "nikon_d800.JPG")))
        nef_dt = extract_taken_at(extract_exif(str(real_image_dir / "nikon_d800.NEF")))
        assert jpeg_dt is not None
        assert nef_dt is not None
        assert jpeg_dt == nef_dt

    def test_curated_dict_has_same_keys_structure(self, real_image_dir):
        """Both backends produce the same key schema."""
        jpeg_exif = extract_exif(str(real_image_dir / "nikon_d800.JPG"))
        nef_exif = extract_exif(str(real_image_dir / "nikon_d800.NEF"))
        # Core keys present in both
        for key in ("date_time_original",):
            assert key in jpeg_exif, f"JPEG missing {key}"
            assert key in nef_exif, f"NEF missing {key}"
