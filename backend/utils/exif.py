"""EXIF extraction utilities.

Uses Pillow's built-in EXIF support plus piexif for structured tag decoding.
Returns plain Python dicts (JSON-serialisable) suitable for the JSONB column.
"""

import logging
from datetime import datetime

from PIL import Image
from PIL.ExifTags import TAGS

log = logging.getLogger(__name__)

_DATETIME_TAGS = {"DateTimeOriginal", "DateTime", "DateTimeDigitized"}
_DATETIME_FMT = "%Y:%m:%d %H:%M:%S"


def extract_exif(file_path: str) -> dict:
    """Extract EXIF metadata from an image file.

    Returns a dict with human-readable tag names as keys.
    Values are coerced to JSON-serialisable types (str, int, float, list).
    Unknown or unreadable tags are silently skipped.
    """
    result: dict = {}
    try:
        with Image.open(file_path) as img:
            raw = img._getexif()  # type: ignore[attr-defined]
            if raw is None:
                return result
            for tag_id, value in raw.items():
                tag_name = TAGS.get(tag_id, str(tag_id))
                coerced = _coerce(value)
                if coerced is not None:
                    result[tag_name] = coerced
    except Exception as exc:
        log.warning("Could not read EXIF from %s: %s", file_path, exc)
    return result


def extract_taken_at(exif_data: dict) -> datetime | None:
    """Parse DateTimeOriginal (or DateTime) from the exif dict into a datetime."""
    for key in ("DateTimeOriginal", "DateTime", "DateTimeDigitized"):
        raw = exif_data.get(key)
        if raw:
            try:
                return datetime.strptime(raw, _DATETIME_FMT)
            except (ValueError, TypeError):
                continue
    return None


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _coerce(value) -> str | int | float | list | None:
    """Coerce an EXIF value to a JSON-serialisable type."""
    if isinstance(value, (str, int, float)):
        return value
    if isinstance(value, bytes):
        try:
            return value.decode("utf-8", errors="replace")
        except Exception:
            return None
    if isinstance(value, tuple):
        coerced = [_coerce(v) for v in value]
        return [v for v in coerced if v is not None]
    # IFDRational and similar numeric types
    try:
        return float(value)
    except (TypeError, ValueError, ZeroDivisionError):
        pass
    try:
        return str(value)
    except Exception:
        return None
