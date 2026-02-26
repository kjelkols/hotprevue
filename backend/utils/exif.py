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


def extract_camera_fields(exif_data: dict) -> dict:
    """Extract structured camera metadata from the coerced exif dict.

    Returns a dict with keys matching Photo column names (camera_make, camera_model, etc.).
    Only keys with actual values are included.
    """
    result: dict = {}

    if make := exif_data.get("Make"):
        result["camera_make"] = str(make).strip()
    if model := exif_data.get("Model"):
        result["camera_model"] = str(model).strip()
    if lens := exif_data.get("LensModel"):
        result["lens_model"] = str(lens).strip()

    iso = exif_data.get("ISOSpeedRatings")
    if isinstance(iso, (int, float)):
        result["iso"] = int(iso)
    elif isinstance(iso, list) and iso:
        result["iso"] = int(iso[0])

    if (et := exif_data.get("ExposureTime")) is not None:
        try:
            result["shutter_speed"] = _float_to_shutter(float(et))
        except (TypeError, ValueError, ZeroDivisionError):
            pass

    if (fn := exif_data.get("FNumber")) is not None:
        try:
            result["aperture"] = round(float(fn), 1)
        except (TypeError, ValueError):
            pass

    if (fl := exif_data.get("FocalLength")) is not None:
        try:
            result["focal_length"] = round(float(fl), 1)
        except (TypeError, ValueError):
            pass

    return result


def extract_gps(file_path: str) -> tuple[float | None, float | None]:
    """Extract GPS latitude and longitude from image EXIF.

    Returns (lat, lng) in decimal degrees, or (None, None) if not available.
    """
    try:
        with Image.open(file_path) as img:
            raw = img._getexif()  # type: ignore[attr-defined]
            if raw is None:
                return None, None
            gps_raw = raw.get(34853)  # GPSInfo tag ID
            if not gps_raw or not isinstance(gps_raw, dict):
                return None, None
            lat = _dms_to_decimal(gps_raw.get(2), gps_raw.get(1))
            lng = _dms_to_decimal(gps_raw.get(4), gps_raw.get(3))
            return lat, lng
    except Exception:
        return None, None


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

def _dms_to_decimal(dms, ref) -> float | None:
    """Convert degrees/minutes/seconds + hemisphere ref to decimal degrees."""
    if not dms or not ref:
        return None
    try:
        d, m, s = float(dms[0]), float(dms[1]), float(dms[2])
        decimal = d + m / 60 + s / 3600
        if ref in ("S", "W"):
            decimal = -decimal
        return round(decimal, 7)
    except Exception:
        return None


def _float_to_shutter(value: float) -> str:
    """Convert float exposure time to a human-readable fraction, e.g. 0.004 → '1/250'."""
    if value >= 1:
        return f"{value:.0f}s"
    denom = round(1 / value)
    return f"1/{denom}"


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
