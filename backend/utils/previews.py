"""Preview generation utilities.

All functions are synchronous — call them directly (or in a thread pool
executor if you need to keep an async event loop unblocked for long batches).
"""

import base64
import hashlib
import io
import os
from pathlib import Path

from PIL import Image

HOTPREVIEW_SIZE = (150, 150)
COLDPREVIEW_MAX = 1200  # longest edge


def generate_hotpreview(file_path: str) -> tuple[bytes, str]:
    """Generate a 150×150 JPEG thumbnail.

    Returns:
        (jpeg_bytes, hothash)  — hothash is SHA256 of the raw bytes.
    """
    with Image.open(file_path) as img:
        img = _to_rgb(img)
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
    return jpeg_bytes, hothash


def hotpreview_b64(jpeg_bytes: bytes) -> str:
    """Return base64-encoded hotpreview string."""
    return base64.b64encode(jpeg_bytes).decode("ascii")


def generate_coldpreview(file_path: str, hothash: str, coldpreview_dir: str) -> str:
    """Generate an 800–1200px JPEG coldpreview and save it to disk.

    Directory layout: <coldpreview_dir>/<hothash[0:2]>/<hothash[2:4]>/<hothash>.jpg

    Returns:
        Absolute path to the saved coldpreview file.
    """
    dest_path = _coldpreview_path(hothash, coldpreview_dir)
    os.makedirs(dest_path.parent, exist_ok=True)

    with Image.open(file_path) as img:
        img = _to_rgb(img)

        # Scale so the longest edge is at most COLDPREVIEW_MAX
        w, h = img.size
        if max(w, h) > COLDPREVIEW_MAX:
            scale = COLDPREVIEW_MAX / max(w, h)
            img = img.resize((int(w * scale), int(h * scale)), Image.LANCZOS)

        img.save(str(dest_path), format="JPEG", quality=85, optimize=True)

    return str(dest_path)


def coldpreview_exists(hothash: str, coldpreview_dir: str) -> bool:
    return _coldpreview_path(hothash, coldpreview_dir).exists()


# ---------------------------------------------------------------------------
# Internal helpers
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
