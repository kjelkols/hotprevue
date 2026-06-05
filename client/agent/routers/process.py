import base64
import hashlib
import tempfile
from pathlib import Path

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import Response
from pydantic import BaseModel

from utils.exif import extract_exif, extract_camera_fields, extract_taken_at, extract_gps
from utils.previews import generate_hotpreview, hotpreview_b64, generate_coldpreview, generate_preview
from utils.quality import compute_quality_metrics

router = APIRouter(prefix="/process", tags=["process"])


class HashRequest(BaseModel):
    master: str


class HashResponse(BaseModel):
    hothash: str
    hotpreview_b64: str
    width: int
    height: int


@router.post("/hash", response_model=HashResponse)
def hash_file(req: HashRequest) -> HashResponse:
    if not Path(req.master).exists():
        raise HTTPException(status_code=404, detail=f"Fil finnes ikke: {req.master}")
    try:
        jpeg_bytes, hothash, width, height = generate_hotpreview(req.master)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Hotpreview feilet: {exc}")
    return HashResponse(
        hothash=hothash,
        hotpreview_b64=hotpreview_b64(jpeg_bytes),
        width=width,
        height=height,
    )


class ProcessRequest(BaseModel):
    master: str
    companions: list[str] = []


class ProcessResponse(BaseModel):
    hothash: str
    hotpreview_b64: str
    coldpreview_b64: str
    exif: dict
    camera_fields: dict
    taken_at: str | None
    gps_lat: float | None
    gps_lng: float | None
    width: int
    height: int
    sharpness_score: float | None
    exposure_mean: float | None
    exposure_clipping: float | None
    noise_score: float | None


@router.post("", response_model=ProcessResponse)
def process(req: ProcessRequest) -> ProcessResponse:
    master = req.master
    if not Path(master).exists():
        raise HTTPException(status_code=404, detail=f"Fil finnes ikke: {master}")

    try:
        jpeg_bytes, hothash, width, height = generate_hotpreview(master)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Hotpreview feilet: {exc}")

    try:
        with tempfile.TemporaryDirectory() as tmp:
            coldpreview_path = generate_coldpreview(master, hothash, tmp)
            coldpreview_bytes = Path(coldpreview_path).read_bytes()
        coldpreview_b64 = base64.b64encode(coldpreview_bytes).decode("ascii")
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Coldpreview feilet: {exc}")

    try:
        exif = extract_exif(master)
        camera_fields = extract_camera_fields(master)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"EXIF-ekstraksjon feilet: {exc}")

    taken_at_dt = extract_taken_at(exif)
    gps_lat, gps_lng = extract_gps(exif)

    quality = compute_quality_metrics(master)

    return ProcessResponse(
        hothash=hothash,
        hotpreview_b64=hotpreview_b64(jpeg_bytes),
        coldpreview_b64=coldpreview_b64,
        exif=exif,
        camera_fields=camera_fields,
        taken_at=taken_at_dt.isoformat() if taken_at_dt else None,
        gps_lat=gps_lat,
        gps_lng=gps_lng,
        width=width,
        height=height,
        sharpness_score=quality["sharpness_score"],
        exposure_mean=quality["exposure_mean"],
        exposure_clipping=quality["exposure_clipping"],
        noise_score=quality["noise_score"],
    )


class ExifOut(BaseModel):
    taken_at: str | None
    camera_make: str | None
    camera_model: str | None
    lens_model: str | None
    iso: int | None
    shutter_speed: str | None
    aperture: float | None
    focal_length: float | None
    gps_lat: float | None
    gps_lng: float | None
    width: int | None
    height: int | None
    file_size: int | None


@router.get("/exif", response_model=ExifOut)
def get_exif(path: str = Query(...)) -> ExifOut:
    """Return EXIF metadata for a file without generating any preview."""
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"Fil finnes ikke: {path}")
    try:
        exif = extract_exif(path)
        cam = extract_camera_fields(path)
        dt = extract_taken_at(exif)
        lat, lng = extract_gps(exif)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"EXIF-ekstraksjon feilet: {exc}")

    stat = p.stat()
    return ExifOut(
        taken_at=dt.isoformat() if dt else None,
        camera_make=cam.get("camera_make"),
        camera_model=cam.get("camera_model"),
        lens_model=cam.get("lens_model"),
        iso=cam.get("iso"),
        shutter_speed=cam.get("shutter_speed"),
        aperture=cam.get("aperture"),
        focal_length=cam.get("focal_length"),
        gps_lat=lat,
        gps_lng=lng,
        width=exif.get("width"),
        height=exif.get("height"),
        file_size=stat.st_size,
    )


@router.get("/preview")
def preview_image(
    path: str = Query(...),
    maxpx: int = Query(default=1600, ge=100, le=8000),
) -> Response:
    """Serve a scaled JPEG preview directly from the original file. No storage."""
    p = Path(path)
    if not p.exists():
        raise HTTPException(status_code=404, detail=f"Fil finnes ikke: {path}")
    try:
        jpeg_bytes = generate_preview(path, maxpx)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Forhåndsvisning feilet: {exc}")

    stat = p.stat()
    etag = hashlib.md5(f"{path}{stat.st_mtime}".encode()).hexdigest()
    return Response(
        content=jpeg_bytes,
        media_type="image/jpeg",
        headers={
            "ETag": f'"{etag}"',
            "Cache-Control": "private, max-age=3600",
        },
    )
