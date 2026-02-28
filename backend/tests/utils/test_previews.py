"""Unit tests for utils/previews.py — JPEG and RAW (rawpy) backends.

No database required. Tests functions directly on real camera files.
Run with: uv run pytest --real-images tests/utils/test_previews.py
"""

import io
from pathlib import Path

import pytest
from PIL import Image

from utils.previews import generate_coldpreview, generate_hotpreview


# ---------------------------------------------------------------------------
# Hotpreview — common contract
# ---------------------------------------------------------------------------

@pytest.mark.real_images
class TestHotpreviewContract:
    def test_jpeg_returns_correct_tuple(self, real_image_dir):
        jpeg_bytes, hothash, orig_w, orig_h = generate_hotpreview(
            str(real_image_dir / "nikon_d800.JPG")
        )
        assert isinstance(jpeg_bytes, bytes) and len(jpeg_bytes) > 0
        assert len(hothash) == 64
        assert isinstance(orig_w, int) and orig_w > 0
        assert isinstance(orig_h, int) and orig_h > 0

    def test_nef_returns_correct_tuple(self, real_image_dir):
        jpeg_bytes, hothash, orig_w, orig_h = generate_hotpreview(
            str(real_image_dir / "nikon_d800.NEF")
        )
        assert isinstance(jpeg_bytes, bytes) and len(jpeg_bytes) > 0
        assert len(hothash) == 64
        assert isinstance(orig_w, int) and orig_w > 0
        assert isinstance(orig_h, int) and orig_h > 0

    def test_jpeg_hotpreview_is_150x150(self, real_image_dir):
        jpeg_bytes, _, _, _ = generate_hotpreview(str(real_image_dir / "nikon_d800.JPG"))
        img = Image.open(io.BytesIO(jpeg_bytes))
        assert img.size == (150, 150)

    def test_nef_hotpreview_is_150x150(self, real_image_dir):
        jpeg_bytes, _, _, _ = generate_hotpreview(str(real_image_dir / "nikon_d800.NEF"))
        img = Image.open(io.BytesIO(jpeg_bytes))
        assert img.size == (150, 150)

    def test_hothash_is_deterministic_for_jpeg(self, real_image_dir):
        path = str(real_image_dir / "nikon_d800.JPG")
        _, h1, _, _ = generate_hotpreview(path)
        _, h2, _, _ = generate_hotpreview(path)
        assert h1 == h2

    def test_hothash_is_deterministic_for_nef(self, real_image_dir):
        path = str(real_image_dir / "nikon_d800.NEF")
        _, h1, _, _ = generate_hotpreview(path)
        _, h2, _, _ = generate_hotpreview(path)
        assert h1 == h2


# ---------------------------------------------------------------------------
# RAW dimensions: orig_w/orig_h must be actual sensor size, not thumbnail
# ---------------------------------------------------------------------------

@pytest.mark.real_images
class TestRawDimensions:
    def test_nef_dimensions_are_full_sensor_size(self, real_image_dir):
        """orig_w/orig_h from NEF must reflect the actual RAW sensor dimensions,
        not the size of any embedded JPEG thumbnail.

        Nikon D800 is a 36 MP camera (~7360×4912 effective pixels).
        An embedded thumbnail is typically ≤1024 px on the long side.
        """
        _, _, orig_w, orig_h = generate_hotpreview(
            str(real_image_dir / "nikon_d800.NEF")
        )
        # Must be far larger than a typical thumbnail
        assert orig_w > 3000, f"Expected RAW width > 3000, got {orig_w}"
        assert orig_h > 2000, f"Expected RAW height > 2000, got {orig_h}"

    def test_jpeg_dimensions_match_actual_image(self, real_image_dir):
        jpeg_path = str(real_image_dir / "nikon_d800.JPG")
        _, _, orig_w, orig_h = generate_hotpreview(jpeg_path)
        with Image.open(jpeg_path) as img:
            actual_w, actual_h = img.size
        assert orig_w == actual_w
        assert orig_h == actual_h


# ---------------------------------------------------------------------------
# Coldpreview
# ---------------------------------------------------------------------------

@pytest.mark.real_images
class TestColdpreview:
    def test_jpeg_coldpreview_created_on_disk(self, real_image_dir, tmp_path):
        jpeg = str(real_image_dir / "nikon_d800.JPG")
        _, hothash, _, _ = generate_hotpreview(jpeg)
        coldpreview_dir = str(tmp_path / "cold")

        path = generate_coldpreview(jpeg, hothash, coldpreview_dir)
        assert Path(path).exists()

    def test_nef_coldpreview_created_on_disk(self, real_image_dir, tmp_path):
        nef = str(real_image_dir / "nikon_d800.NEF")
        _, hothash, _, _ = generate_hotpreview(nef)
        coldpreview_dir = str(tmp_path / "cold")

        path = generate_coldpreview(nef, hothash, coldpreview_dir)
        assert Path(path).exists()

    def test_coldpreview_respects_max_px(self, real_image_dir, tmp_path):
        nef = str(real_image_dir / "nikon_d800.NEF")
        _, hothash, _, _ = generate_hotpreview(nef)
        coldpreview_dir = str(tmp_path / "cold")

        path = generate_coldpreview(nef, hothash, coldpreview_dir, max_px=800)
        img = Image.open(path)
        assert max(img.size) <= 800

    def test_coldpreview_is_valid_jpeg(self, real_image_dir, tmp_path):
        nef = str(real_image_dir / "nikon_d800.NEF")
        _, hothash, _, _ = generate_hotpreview(nef)
        coldpreview_dir = str(tmp_path / "cold")

        path = generate_coldpreview(nef, hothash, coldpreview_dir)
        img = Image.open(path)
        assert img.format == "JPEG"
        assert img.mode == "RGB"

    def test_coldpreview_path_layout(self, real_image_dir, tmp_path):
        """Coldpreviews are stored in hothash[:2]/hothash[2:4]/ subdirectory."""
        jpeg = str(real_image_dir / "nikon_d800.JPG")
        _, hothash, _, _ = generate_hotpreview(jpeg)
        coldpreview_dir = str(tmp_path / "cold")

        path = generate_coldpreview(jpeg, hothash, coldpreview_dir)
        p = Path(path)
        assert p.parent.name == hothash[2:4]
        assert p.parent.parent.name == hothash[:2]
        assert p.stem == hothash
