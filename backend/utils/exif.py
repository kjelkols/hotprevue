"""EXIF extraction utilities.

Public API:
    extract_exif(file_path)       → curated dict stored in Photo.exif_data (JSONB)
    extract_camera_fields(file_path) → dict of dedicated Photo column values
    extract_taken_at(exif_data)   → datetime | None  (reads from curated dict)
    extract_gps(exif_data)        → (lat, lng) | (None, None)  (reads from curated dict)
"""

import logging
from datetime import datetime

from PIL import Image
from PIL.ExifTags import TAGS

log = logging.getLogger(__name__)

_DATETIME_FMT = "%Y:%m:%d %H:%M:%S"

# ---------------------------------------------------------------------------
# Enum → human-readable string mappings
# ---------------------------------------------------------------------------

_EXPOSURE_PROGRAM = {
    0: "undefined", 1: "manual", 2: "normal", 3: "aperture priority",
    4: "shutter priority", 5: "creative", 6: "action",
    7: "portrait", 8: "landscape",
}
_EXPOSURE_MODE = {0: "auto", 1: "manual", 2: "auto bracket"}
_WHITE_BALANCE = {0: "auto", 1: "manual"}
_METERING_MODE = {
    0: "unknown", 1: "average", 2: "center weighted", 3: "spot",
    4: "multi spot", 5: "pattern", 6: "partial", 255: "other",
}
_COLOR_SPACE = {1: "sRGB", 65535: "uncalibrated"}
_SCENE_TYPE = {0: "standard", 1: "landscape", 2: "portrait", 3: "night"}
_LIGHT_SOURCE = {
    0: "unknown", 1: "daylight", 2: "fluorescent", 3: "tungsten",
    4: "flash", 9: "fine weather", 10: "cloudy", 11: "shade",
    255: "other",
}


def _flash_str(value: int) -> str:
    """Interpret Flash bitmask as a short human-readable string."""
    fired = bool(value & 0x1)
    return "fired" if fired else "no flash"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_exif(file_path: str) -> dict:
    """Return a curated EXIF dict for storage in Photo.exif_data (JSONB).

    Includes DateTimeOriginal and GPS for double-storage (user can override
    taken_at and location_* columns; exif_data preserves the original values).

    Fields with no value are omitted entirely.
    """
    raw = _read_raw(file_path)
    if not raw:
        return {}
    return _build_curated(raw)


def extract_camera_fields(file_path: str) -> dict:
    """Return camera metadata for dedicated Photo columns.

    Keys: camera_make, camera_model, lens_model, iso,
          shutter_speed, aperture, focal_length.
    Only keys with actual values are included.
    """
    raw = _read_raw(file_path)
    if not raw:
        return {}
    return _build_camera_fields(raw)


def extract_taken_at(exif_data: dict) -> datetime | None:
    """Parse taken_at from the curated exif dict (date_time_original field)."""
    raw_dt = exif_data.get("date_time_original")
    if raw_dt:
        try:
            return datetime.strptime(raw_dt, _DATETIME_FMT)
        except (ValueError, TypeError):
            pass
    return None


def extract_gps(exif_data: dict) -> tuple[float | None, float | None]:
    """Return (lat, lng) from the curated exif dict, or (None, None)."""
    return exif_data.get("gps_lat"), exif_data.get("gps_lng")


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _read_raw(file_path: str) -> dict | None:
    """Open image and return the raw Pillow EXIF tag dict, or None on failure."""
    try:
        with Image.open(file_path) as img:
            return img._getexif()  # type: ignore[attr-defined]
    except Exception as exc:
        log.warning("Could not read EXIF from %s: %s", file_path, exc)
        return None


def _build_curated(raw: dict) -> dict:
    """Build the curated exif_data dict from raw Pillow tags."""
    by_name = {TAGS.get(k, str(k)): v for k, v in raw.items()}

    result: dict = {}

    def _set(key, value):
        if value is not None:
            result[key] = value

    # --- Double-stored: user can override taken_at and location columns ---
    _set("date_time_original", _str_or_none(by_name.get("DateTimeOriginal")))
    _set("date_time_subsec",   _str_or_none(by_name.get("SubsecTimeOriginal")))
    _set("datetime_digitized", _str_or_none(by_name.get("DateTimeDigitized")))

    lat, lng = _extract_gps_from_raw(raw)
    _set("gps_lat", lat)
    _set("gps_lng", lng)

    # --- Image geometry ---
    _set("width",       _int_or_none(by_name.get("ExifImageWidth")))
    _set("height",      _int_or_none(by_name.get("ExifImageHeight")))
    _set("orientation", _int_or_none(by_name.get("Orientation")))

    # --- Exposure ---
    _set("focal_length_35mm", _int_or_none(by_name.get("FocalLengthIn35mmFilm")))
    _set("ev_comp", _round_or_none(by_name.get("ExposureBiasValue"), 2))
    _set("exposure_program", _lookup(by_name.get("ExposureProgram"), _EXPOSURE_PROGRAM))
    _set("exposure_mode",    _lookup(by_name.get("ExposureMode"), _EXPOSURE_MODE))
    if (flash := by_name.get("Flash")) is not None:
        result["flash"] = _flash_str(int(flash))

    # --- Camera settings ---
    _set("white_balance",  _lookup(by_name.get("WhiteBalance"), _WHITE_BALANCE))
    _set("metering_mode",  _lookup(by_name.get("MeteringMode"), _METERING_MODE))
    _set("color_space",    _lookup(by_name.get("ColorSpace"), _COLOR_SPACE))
    _set("scene_type",     _lookup(by_name.get("SceneCaptureType"), _SCENE_TYPE))
    _set("light_source",   _lookup(by_name.get("LightSource"), _LIGHT_SOURCE))

    # --- Origin / attribution ---
    _set("software",  _str_or_none(by_name.get("Software")))
    _set("artist",    _nonempty_str(by_name.get("Artist")))
    _set("copyright", _nonempty_str(by_name.get("Copyright")))

    return result


def _build_camera_fields(raw: dict) -> dict:
    """Build dedicated Photo column values from raw Pillow tags."""
    by_name = {TAGS.get(k, str(k)): v for k, v in raw.items()}
    result: dict = {}

    if make := _str_or_none(by_name.get("Make")):
        result["camera_make"] = make.strip()
    if model := _str_or_none(by_name.get("Model")):
        result["camera_model"] = model.strip()
    if lens := _str_or_none(by_name.get("LensModel")):
        result["lens_model"] = lens.strip()

    iso = by_name.get("ISOSpeedRatings")
    if isinstance(iso, (int, float)):
        result["iso"] = int(iso)
    elif isinstance(iso, (list, tuple)) and iso:
        result["iso"] = int(iso[0])

    if (et := by_name.get("ExposureTime")) is not None:
        try:
            result["shutter_speed"] = _float_to_shutter(float(et))
        except (TypeError, ValueError, ZeroDivisionError):
            pass

    if (fn := by_name.get("FNumber")) is not None:
        try:
            result["aperture"] = round(float(fn), 1)
        except (TypeError, ValueError):
            pass

    if (fl := by_name.get("FocalLength")) is not None:
        try:
            result["focal_length"] = round(float(fl), 1)
        except (TypeError, ValueError):
            pass

    return result


def _extract_gps_from_raw(raw: dict) -> tuple[float | None, float | None]:
    """Extract GPS lat/lng from raw Pillow EXIF dict."""
    gps_raw = raw.get(34853)  # GPSInfo tag ID
    if not gps_raw or not isinstance(gps_raw, dict):
        return None, None
    lat = _dms_to_decimal(gps_raw.get(2), gps_raw.get(1))
    lng = _dms_to_decimal(gps_raw.get(4), gps_raw.get(3))
    return lat, lng


def _dms_to_decimal(dms, ref) -> float | None:
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
    if value >= 1:
        return f"{value:.0f}s"
    return f"1/{round(1 / value)}"


def _str_or_none(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    return str(value).replace("\x00", "") or None


def _nonempty_str(value) -> str | None:
    """Like _str_or_none but also returns None for whitespace-only strings."""
    s = _str_or_none(value)
    return s.strip() if s and s.strip() else None


def _int_or_none(value) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _round_or_none(value, decimals: int) -> float | None:
    if value is None:
        return None
    try:
        return round(float(value), decimals)
    except (TypeError, ValueError, ZeroDivisionError):
        return None


def _lookup(value, mapping: dict) -> str | None:
    if value is None:
        return None
    return mapping.get(int(value))
