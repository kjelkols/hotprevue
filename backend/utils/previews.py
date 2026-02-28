"""Preview generation utilities.

All functions are synchronous — call them directly (or in a thread pool
executor if you need to keep an async event loop unblocked for long batches).

RAW files are handled via rawpy (LibRaw):
- Hotpreview: extracts the embedded JPEG thumbnail (fast) with full-decode fallback.
- Coldpreview: full LibRaw decode for maximum quality.
"""

import base64
import hashlib
import io
import os
from pathlib import Path

from PIL import Image

from utils.registration import RAW_EXTENSIONS

HOTPREVIEW_SIZE = (150, 150)
COLDPREVIEW_MAX_DEFAULT = 1200  # longest edge — override via SystemSettings


def _is_raw(file_path: str) -> bool:
    return Path(file_path).suffix.lower() in RAW_EXTENSIONS


def generate_hotpreview(file_path: str) -> tuple[bytes, str, int, int]:
    """Generate a 150×150 JPEG thumbnail.

    For RAW files: uses the embedded JPEG thumbnail (fast). Falls back to
    full LibRaw decode if no embedded thumbnail is available.

    Returns:
        (jpeg_bytes, hothash, orig_width, orig_height)
        orig_width/height are the actual image dimensions before thumbnailing.
    """
    if _is_raw(file_path):
        img, orig_w, orig_h = _raw_open_for_thumb(file_path)
    else:
        with Image.open(file_path) as f:
            img = _to_rgb(f).copy()  # .copy() forces full load before file closes
            orig_w, orig_h = img.size

    img.thumbnail(HOTPREVIEW_SIZE, Image.LANCZOS)

    # Centre-crop to exact 150×150
    w, h = img.size
    tw, th = HOTPREVIEW_SIZE
    left = (w - tw) // 2
    top = (h - th) // 2
    img = img.crop((left, top, left + tw, top + th))

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80, optimize=True)
    jpeg_bytes = buf.getvalue()

    hothash = hashlib.sha256(jpeg_bytes).hexdigest()
    return jpeg_bytes, hothash, orig_w, orig_h


def hotpreview_b64(jpeg_bytes: bytes) -> str:
    """Return base64-encoded hotpreview string."""
    return base64.b64encode(jpeg_bytes).decode("ascii")


def generate_coldpreview(
    file_path: str,
    hothash: str,
    coldpreview_dir: str,
    max_px: int = COLDPREVIEW_MAX_DEFAULT,
    quality: int = 85,
) -> str:
    """Generate a JPEG coldpreview and save it to disk.

    For RAW files: full LibRaw decode for maximum quality.
    Directory layout: <coldpreview_dir>/<hothash[0:2]>/<hothash[2:4]>/<hothash>.jpg

    Returns:
        Absolute path to the saved coldpreview file.
    """
    dest_path = _coldpreview_path(hothash, coldpreview_dir)
    os.makedirs(dest_path.parent, exist_ok=True)

    if _is_raw(file_path):
        img = _raw_open_full(file_path)
    else:
        with Image.open(file_path) as f:
            img = _to_rgb(f).copy()

    w, h = img.size
    if max(w, h) > max_px:
        scale = max_px / max(w, h)
        img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

    img.save(str(dest_path), format="JPEG", quality=quality, optimize=True)
    return str(dest_path)


def coldpreview_exists(hothash: str, coldpreview_dir: str) -> bool:
    return _coldpreview_path(hothash, coldpreview_dir).exists()


# ---------------------------------------------------------------------------
# RAW helpers (rawpy / LibRaw)
# ---------------------------------------------------------------------------

def _raw_open_for_thumb(file_path: str) -> tuple[Image.Image, int, int]:
    """Open RAW for hotpreview. Uses embedded JPEG thumbnail when available.

    Returns (PIL Image in RGB, orig_width, orig_height).
    orig dimensions come from LibRaw sensor size (actual RAW dimensions).
    """
    import rawpy  # deferred — not needed for non-RAW paths

    with rawpy.imread(file_path) as raw:
        orig_w = raw.sizes.width
        orig_h = raw.sizes.height

        try:
            thumb = raw.extract_thumb()
            if thumb.format == rawpy.ThumbFormat.JPEG:
                img = Image.open(io.BytesIO(thumb.data))
                return _to_rgb(img), orig_w, orig_h
        except Exception:
            pass

        # No embedded thumbnail — full decode
        rgb = raw.postprocess(use_camera_wb=True, output_bps=8)

    import numpy as np  # noqa: F401 — Image.fromarray requires numpy
    img = Image.fromarray(rgb)
    return _to_rgb(img), orig_w, orig_h


def _raw_open_full(file_path: str) -> Image.Image:
    """Full LibRaw decode for coldpreview quality."""
    import rawpy

    with rawpy.imread(file_path) as raw:
        rgb = raw.postprocess(use_camera_wb=True, output_bps=8)

    import numpy as np  # noqa: F401
    return _to_rgb(Image.fromarray(rgb))


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _coldpreview_path(hothash: str, coldpreview_dir: str) -> Path:
    return Path(coldpreview_dir) / hothash[:2] / hothash[2:4] / f"{hothash}.jpg"


def _to_rgb(img: Image.Image) -> Image.Image:
    """Convert palette/RGBA/other modes to RGB."""
    if img.mode in ("RGBA", "P", "LA"):
        background = Image.new("RGB", img.size, (255, 255, 255))
        if img.mode == "P":
            img = img.convert("RGBA")
        background.paste(img, mask=img.split()[-1] if img.mode in ("RGBA", "LA") else None)
        return background
    if img.mode != "RGB":
        return img.convert("RGB")
    return img
