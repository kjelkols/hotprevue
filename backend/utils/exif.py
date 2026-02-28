"""EXIF extraction utilities.

Two backends:
- Pillow  — JPEG, TIFF, PNG, HEIC
- exifread — RAW (CR2, NEF, ARW, DNG, ORF, RW2, RAF, PEF, SRW)

Public API:
    extract_exif(file_path)          → curated dict stored in ImageFile.exif_data (JSONB)
    extract_camera_fields(file_path) → dict of dedicated Photo column values
    extract_taken_at(exif_data)      → datetime | None  (reads from curated dict)
    extract_gps(exif_data)           → (lat, lng) | (None, None)  (reads from curated dict)
"""

import logging
from datetime import datetime
from pathlib import Path

from PIL import Image
from PIL.ExifTags import TAGS

from utils.registration import RAW_EXTENSIONS

log = logging.getLogger(__name__)

_DATETIME_FMT = "%Y:%m:%d %H:%M:%S"

# ---------------------------------------------------------------------------
# Enum → human-readable string mappings (shared by both backends)
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
    return "fired" if bool(value & 0x1) else "no flash"


def _is_raw(file_path: str) -> bool:
    return Path(file_path).suffix.lower() in RAW_EXTENSIONS


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------

def extract_exif(file_path: str) -> dict:
    """Return a curated EXIF dict for storage in ImageFile.exif_data (JSONB).

    Routes to the appropriate backend based on file extension.
    Fields with no value are omitted entirely.
    """
    if _is_raw(file_path):
        return _extract_exif_raw(file_path)
    return _extract_exif_pillow(file_path)


def extract_camera_fields(file_path: str) -> dict:
    """Return camera metadata for dedicated Photo columns.

    Keys: camera_make, camera_model, lens_model, iso,
          shutter_speed, aperture, focal_length.
    Only keys with actual values are included.
    """
    if _is_raw(file_path):
        return _extract_camera_fields_raw(file_path)
    return _extract_camera_fields_pillow(file_path)


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
# Pillow backend (JPEG, TIFF, PNG, HEIC)
# ---------------------------------------------------------------------------

def _extract_exif_pillow(file_path: str) -> dict:
    raw = _pillow_read_raw(file_path)
    if not raw:
        return {}
    return _pillow_build_curated(raw)


def _extract_camera_fields_pillow(file_path: str) -> dict:
    raw = _pillow_read_raw(file_path)
    if not raw:
        return {}
    return _pillow_build_camera_fields(raw)


def _pillow_read_raw(file_path: str) -> dict | None:
    try:
        with Image.open(file_path) as img:
            return img._getexif()  # type: ignore[attr-defined]
    except Exception as exc:
        log.warning("Pillow: could not read EXIF from %s: %s", file_path, exc)
        return None


def _pillow_build_curated(raw: dict) -> dict:
    by_name = {TAGS.get(k, str(k)): v for k, v in raw.items()}
    result: dict = {}

    def _set(key, value):
        if value is not None:
            result[key] = value

    _set("date_time_original", _str_or_none(by_name.get("DateTimeOriginal")))
    _set("date_time_subsec",   _str_or_none(by_name.get("SubsecTimeOriginal")))
    _set("datetime_digitized", _str_or_none(by_name.get("DateTimeDigitized")))

    lat, lng = _pillow_extract_gps(raw)
    _set("gps_lat", lat)
    _set("gps_lng", lng)

    _set("width",       _int_or_none(by_name.get("ExifImageWidth")))
    _set("height",      _int_or_none(by_name.get("ExifImageHeight")))
    _set("orientation", _int_or_none(by_name.get("Orientation")))

    _set("focal_length_35mm", _int_or_none(by_name.get("FocalLengthIn35mmFilm")))
    _set("ev_comp", _round_or_none(by_name.get("ExposureBiasValue"), 2))
    _set("exposure_program", _lookup(by_name.get("ExposureProgram"), _EXPOSURE_PROGRAM))
    _set("exposure_mode",    _lookup(by_name.get("ExposureMode"), _EXPOSURE_MODE))
    if (flash := by_name.get("Flash")) is not None:
        result["flash"] = _flash_str(int(flash))

    _set("white_balance",  _lookup(by_name.get("WhiteBalance"), _WHITE_BALANCE))
    _set("metering_mode",  _lookup(by_name.get("MeteringMode"), _METERING_MODE))
    _set("color_space",    _lookup(by_name.get("ColorSpace"), _COLOR_SPACE))
    _set("scene_type",     _lookup(by_name.get("SceneCaptureType"), _SCENE_TYPE))
    _set("light_source",   _lookup(by_name.get("LightSource"), _LIGHT_SOURCE))

    _set("software",  _str_or_none(by_name.get("Software")))
    _set("artist",    _nonempty_str(by_name.get("Artist")))
    _set("copyright", _nonempty_str(by_name.get("Copyright")))

    return result


def _pillow_build_camera_fields(raw: dict) -> dict:
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


def _pillow_extract_gps(raw: dict) -> tuple[float | None, float | None]:
    gps_raw = raw.get(34853)  # GPSInfo tag ID
    if not gps_raw or not isinstance(gps_raw, dict):
        return None, None
    lat = _dms_to_decimal(gps_raw.get(2), gps_raw.get(1))
    lng = _dms_to_decimal(gps_raw.get(4), gps_raw.get(3))
    return lat, lng


# ---------------------------------------------------------------------------
# exifread backend (RAW: CR2, NEF, ARW, DNG, ORF, RW2, RAF, PEF, SRW)
# ---------------------------------------------------------------------------

def _extract_exif_raw(file_path: str) -> dict:
    tags = _exifread_tags(file_path)
    if not tags:
        return {}
    return _exifread_build_curated(tags)


def _extract_camera_fields_raw(file_path: str) -> dict:
    tags = _exifread_tags(file_path)
    if not tags:
        return {}
    return _exifread_build_camera_fields(tags)


def _exifread_tags(file_path: str) -> dict | None:
    try:
        import exifread
        with open(file_path, "rb") as f:
            tags = exifread.process_file(f, details=True)
        return tags if tags else None
    except Exception as exc:
        log.warning("exifread: could not read EXIF from %s: %s", file_path, exc)
        return None


def _exifread_build_curated(tags: dict) -> dict:
    result: dict = {}
    g = tags.get

    def _set(key, value):
        if value is not None:
            result[key] = value

    _set("date_time_original", _er_str(g("EXIF DateTimeOriginal")))
    _set("date_time_subsec",   _er_str(g("EXIF SubSecTimeOriginal")))
    _set("datetime_digitized", _er_str(g("EXIF DateTimeDigitized")))

    lat = _er_gps_decimal(g("GPS GPSLatitude"), g("GPS GPSLatitudeRef"))
    lng = _er_gps_decimal(g("GPS GPSLongitude"), g("GPS GPSLongitudeRef"))
    _set("gps_lat", lat)
    _set("gps_lng", lng)

    # Prefer EXIF-reported pixel dimensions; fall back to image-level tags
    w = _er_int(g("EXIF ExifImageWidth")) or _er_int(g("Image ImageWidth"))
    h = (_er_int(g("EXIF ExifImageLength"))
         or _er_int(g("EXIF ExifImageHeight"))
         or _er_int(g("Image ImageLength")))
    _set("width", w)
    _set("height", h)
    _set("orientation", _er_int(g("Image Orientation")))

    _set("focal_length_35mm", _er_int(g("EXIF FocalLengthIn35mmFilm")))
    _set("ev_comp", _er_round(g("EXIF ExposureBiasValue"), 2))
    _set("exposure_program", _er_lookup(g("EXIF ExposureProgram"), _EXPOSURE_PROGRAM))
    _set("exposure_mode",    _er_lookup(g("EXIF ExposureMode"), _EXPOSURE_MODE))
    flash_tag = g("EXIF Flash")
    if flash_tag is not None:
        try:
            result["flash"] = _flash_str(int(flash_tag.values[0]))
        except Exception:
            pass

    _set("white_balance",  _er_lookup(g("EXIF WhiteBalance"), _WHITE_BALANCE))
    _set("metering_mode",  _er_lookup(g("EXIF MeteringMode"), _METERING_MODE))
    _set("color_space",    _er_lookup(g("EXIF ColorSpace"), _COLOR_SPACE))
    _set("scene_type",     _er_lookup(g("EXIF SceneCaptureType"), _SCENE_TYPE))
    _set("light_source",   _er_lookup(g("EXIF LightSource"), _LIGHT_SOURCE))

    _set("software",  _er_nonempty(g("Image Software")))
    _set("artist",    _er_nonempty(g("Image Artist")))
    _set("copyright", _er_nonempty(g("Image Copyright")))

    return result


def _exifread_build_camera_fields(tags: dict) -> dict:
    result: dict = {}
    g = tags.get

    if make := _er_nonempty(g("Image Make")):
        result["camera_make"] = make
    if model := _er_nonempty(g("Image Model")):
        result["camera_model"] = model
    if lens := _er_nonempty(g("EXIF LensModel")):
        result["lens_model"] = lens

    iso_tag = g("EXIF ISOSpeedRatings")
    if iso_tag:
        try:
            result["iso"] = int(iso_tag.values[0])
        except Exception:
            pass

    et = _er_float(g("EXIF ExposureTime"))
    if et is not None:
        try:
            result["shutter_speed"] = _float_to_shutter(et)
        except (TypeError, ValueError, ZeroDivisionError):
            pass

    fn = _er_float(g("EXIF FNumber"))
    if fn is not None:
        result["aperture"] = round(fn, 1)

    fl = _er_float(g("EXIF FocalLength"))
    if fl is not None:
        result["focal_length"] = round(fl, 1)

    return result


# ---------------------------------------------------------------------------
# exifread value helpers
# ---------------------------------------------------------------------------

def _er_str(tag) -> str | None:
    if tag is None:
        return None
    return str(tag.values).strip().replace("\x00", "") or None


def _er_nonempty(tag) -> str | None:
    s = _er_str(tag)
    return s.strip() if s and s.strip() else None


def _er_int(tag) -> int | None:
    if tag is None:
        return None
    try:
        return int(tag.values[0])
    except (IndexError, TypeError, ValueError):
        return None


def _er_float(tag) -> float | None:
    if tag is None:
        return None
    try:
        return float(tag.values[0])
    except (IndexError, TypeError, ValueError, ZeroDivisionError):
        return None


def _er_round(tag, decimals: int) -> float | None:
    if tag is None:
        return None
    try:
        return round(float(tag.values[0]), decimals)
    except (IndexError, TypeError, ValueError, ZeroDivisionError):
        return None


def _er_lookup(tag, mapping: dict) -> str | None:
    if tag is None:
        return None
    try:
        return mapping.get(int(tag.values[0]))
    except (IndexError, TypeError, ValueError):
        return None


def _er_gps_decimal(dms_tag, ref_tag) -> float | None:
    if dms_tag is None or ref_tag is None:
        return None
    try:
        d = float(dms_tag.values[0])
        m = float(dms_tag.values[1])
        s = float(dms_tag.values[2])
        decimal = d + m / 60 + s / 3600
        ref = str(ref_tag.values).strip()
        if ref in ("S", "W"):
            decimal = -decimal
        return round(decimal, 7)
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Shared helpers
# ---------------------------------------------------------------------------

def _str_or_none(value) -> str | None:
    if value is None:
        return None
    if isinstance(value, bytes):
        value = value.decode("utf-8", errors="replace")
    return str(value).replace("\x00", "") or None


def _nonempty_str(value) -> str | None:
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
