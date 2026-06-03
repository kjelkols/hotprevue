"""Lokale filoperasjoner for Preorganisering.

Endepunkter:
  POST /files/move    — flytt en bildegruppe (master + companions) til ny katalog
  POST /files/mkdir   — lag ny katalog
  POST /files/rotate  — roter bilde via EXIF (JPEG) eller XMP sidecar (RAW/andre)
"""

import shutil
import xml.etree.ElementTree as ET
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.registration import scan_directory, JPEG_EXTENSIONS
from agent.routers.prescan import update_cache_path, remove_from_cache, update_cache_after_rotate

router = APIRouter(prefix="/files", tags=["files"])


class MoveRequest(BaseModel):
    master_path: str
    destination_dir: str


class MoveResult(BaseModel):
    moved: list[str]
    destination_dir: str


class DeleteResult(BaseModel):
    deleted: list[str]


class MkdirRequest(BaseModel):
    path: str


class MkdirResult(BaseModel):
    path: str


class RotateRequest(BaseModel):
    file_path: str
    direction: str  # "cw" eller "ccw"


class RotateResult(BaseModel):
    hotpreview_b64: str
    hothash: str
    orientation: int


# Orientation-matrise: CW-rotasjon
_CW  = {1: 6, 2: 7, 3: 8, 4: 5, 5: 2, 6: 3, 7: 4, 8: 1}
_CCW = {v: k for k, v in _CW.items()}


@router.post("/move", response_model=MoveResult)
def move_group(req: MoveRequest) -> MoveResult:
    master = Path(req.master_path)
    dest_dir = Path(req.destination_dir)

    if not master.exists():
        raise HTTPException(status_code=404, detail=f"Fil finnes ikke: {req.master_path}")
    if not dest_dir.exists() or not dest_dir.is_dir():
        raise HTTPException(status_code=404, detail=f"Destinasjonskatalog finnes ikke: {req.destination_dir}")

    # Finn companions via scan_directory på master sin overmappe
    groups, _ = scan_directory(str(master.parent), recursive=False)
    group = next((g for g in groups if g.master == master), None)
    all_files: list[Path] = [master] + (group.companions if group else [])

    moved: list[str] = []
    for src in all_files:
        dst = dest_dir / src.name
        if dst.exists():
            raise HTTPException(
                status_code=409,
                detail=f"Fil finnes allerede i destinasjonen: {dst.name}",
            )
        try:
            _move_file(src, dst)
            update_cache_path(str(src), str(dst))
            moved.append(str(dst))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Kunne ikke flytte {src.name}: {e}")

    return MoveResult(moved=moved, destination_dir=str(dest_dir))


@router.delete("/group", response_model=DeleteResult)
def delete_group(path: str) -> DeleteResult:
    master = Path(path)
    if not master.exists():
        raise HTTPException(status_code=404, detail=f"Fil finnes ikke: {path}")

    groups, _ = scan_directory(str(master.parent), recursive=False)
    group = next((g for g in groups if g.master == master), None)
    all_files: list[Path] = [master] + (group.companions if group else [])

    deleted: list[str] = []
    for f in all_files:
        try:
            f.unlink()
            remove_from_cache(str(f))
            deleted.append(str(f))
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Kunne ikke slette {f.name}: {e}")

    return DeleteResult(deleted=deleted)


@router.post("/rotate", response_model=RotateResult)
def rotate_image(req: RotateRequest) -> RotateResult:
    path = Path(req.file_path)
    if not path.exists():
        raise HTTPException(status_code=404, detail=f"Fil finnes ikke: {req.file_path}")
    if req.direction not in ("cw", "ccw"):
        raise HTTPException(status_code=422, detail="direction må være 'cw' eller 'ccw'")

    current = _get_orientation(path)
    rot_map = _CW if req.direction == "cw" else _CCW
    new_orientation = rot_map.get(current, 1)

    try:
        _write_orientation(path, new_orientation)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kunne ikke skrive orientering: {e}")

    try:
        if path.suffix.lower() in JPEG_EXTENSIONS:
            # JPEG: piexif oppdaterte EXIF — generate_hotpreview bruker exif_transpose
            from utils.previews import generate_hotpreview, hotpreview_b64
            jpeg_bytes, hothash, _w, _h = generate_hotpreview(str(path))
            preview_b64 = hotpreview_b64(jpeg_bytes)
        else:
            # RAW/andre: XMP skrives ikke inn i filen — roter eksisterende preview
            preview_b64, hothash = _rotate_cached_preview(str(path), req.direction)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kunne ikke generere preview: {e}")

    update_cache_after_rotate(str(path), hothash, preview_b64, new_orientation)

    return RotateResult(hotpreview_b64=preview_b64, hothash=hothash, orientation=new_orientation)


@router.post("/mkdir", response_model=MkdirResult)
def make_dir(req: MkdirRequest) -> MkdirResult:
    p = Path(req.path)
    try:
        p.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kunne ikke lage katalog: {e}")
    return MkdirResult(path=str(p))


def _rotate_cached_preview(file_path: str, direction: str) -> tuple[str, str]:
    """For RAW/andre: roter eksisterende hotpreview 90° i stedet for å re-lese filen."""
    import base64
    import hashlib
    import io
    from PIL import Image
    from agent.routers.prescan import _get_conn

    conn = _get_conn()
    try:
        row = conn.execute(
            "SELECT hotpreview_b64 FROM prescan_cache WHERE file_path = ?", (file_path,)
        ).fetchone()
    finally:
        conn.close()

    if row is None or not row["hotpreview_b64"]:
        from utils.previews import generate_hotpreview, hotpreview_b64
        jpeg_bytes, hothash, _, _ = generate_hotpreview(file_path)
        return hotpreview_b64(jpeg_bytes), hothash

    jpeg_bytes = base64.b64decode(row["hotpreview_b64"])
    img = Image.open(io.BytesIO(jpeg_bytes)).convert("RGB")
    method = Image.Transpose.ROTATE_270 if direction == "cw" else Image.Transpose.ROTATE_90
    img = img.transpose(method)

    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=80, optimize=True)
    new_bytes = buf.getvalue()
    new_b64 = base64.b64encode(new_bytes).decode("ascii")
    new_hothash = hashlib.sha256(new_bytes).hexdigest()
    return new_b64, new_hothash


def _move_file(src: Path, dst: Path) -> None:
    """Flytt fil — os.rename hvis samme filesystem (atomisk), shutil.move ellers."""
    try:
        src.rename(dst)
    except OSError:
        shutil.move(str(src), str(dst))


# ─── Orientation-hjelpere ─────────────────────────────────────────────────────

_XMP_TIFF_NS = 'http://ns.adobe.com/tiff/1.0/'
_XMP_RDF_NS  = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
_XMP_X_NS    = 'adobe:ns:meta/'


def _get_orientation(path: Path) -> int:
    """Les gjeldende Orientation (1–8). Returnerer 1 (normal) hvis ikke funnet."""
    ext = path.suffix.lower()
    if ext in JPEG_EXTENSIONS:
        try:
            import piexif
            exif = piexif.load(str(path))
            val = exif.get('0th', {}).get(piexif.ImageIFD.Orientation)
            return int(val) if val else 1
        except Exception:
            return 1
    # RAW og andre: sjekk XMP sidecar
    return _read_xmp_orientation(path.with_suffix('.xmp'))


def _write_orientation(path: Path, orientation: int) -> None:
    ext = path.suffix.lower()
    if ext in JPEG_EXTENSIONS:
        _write_jpeg_orientation(path, orientation)
    else:
        _write_xmp_orientation(path.with_suffix('.xmp'), orientation)


def _write_jpeg_orientation(path: Path, orientation: int) -> None:
    import piexif
    try:
        exif_dict = piexif.load(str(path))
    except Exception:
        exif_dict = {'0th': {}, '1st': {}, 'Exif': {}, 'GPS': {}, 'Interop': {}}
    exif_dict.setdefault('0th', {})[piexif.ImageIFD.Orientation] = orientation
    piexif.insert(piexif.dump(exif_dict), str(path))


def _read_xmp_orientation(xmp_path: Path) -> int:
    if not xmp_path.exists():
        return 1
    try:
        tree = ET.parse(str(xmp_path))
        root = tree.getroot()
        for desc in root.iter(f'{{{_XMP_RDF_NS}}}Description'):
            val = desc.get(f'{{{_XMP_TIFF_NS}}}Orientation')
            if val:
                return int(val)
        for elem in root.iter(f'{{{_XMP_TIFF_NS}}}Orientation'):
            if elem.text:
                return int(elem.text)
    except Exception:
        pass
    return 1


def _write_xmp_orientation(xmp_path: Path, orientation: int) -> None:
    ET.register_namespace('x', _XMP_X_NS)
    ET.register_namespace('rdf', _XMP_RDF_NS)
    ET.register_namespace('tiff', _XMP_TIFF_NS)

    if xmp_path.exists():
        try:
            tree = ET.parse(str(xmp_path))
            root = tree.getroot()
            updated = False
            for desc in root.iter(f'{{{_XMP_RDF_NS}}}Description'):
                key = f'{{{_XMP_TIFF_NS}}}Orientation'
                desc.set(key, str(orientation))
                updated = True
                break
            if not updated:
                # Legg til nytt Description-element
                rdf = root.find(f'{{{_XMP_RDF_NS}}}RDF')
                if rdf is None:
                    rdf = ET.SubElement(root, f'{{{_XMP_RDF_NS}}}RDF')
                desc = ET.SubElement(rdf, f'{{{_XMP_RDF_NS}}}Description')
                desc.set(f'{{{_XMP_RDF_NS}}}about', '')
                desc.set(f'{{{_XMP_TIFF_NS}}}Orientation', str(orientation))
            tree.write(str(xmp_path), encoding='unicode', xml_declaration=False)
            return
        except Exception:
            pass

    # Opprett minimal XMP-fil
    content = (
        '<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>\n'
        '<x:xmpmeta xmlns:x="adobe:ns:meta/">\n'
        '  <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">\n'
        '    <rdf:Description rdf:about=""\n'
        '      xmlns:tiff="http://ns.adobe.com/tiff/1.0/"\n'
        f'      tiff:Orientation="{orientation}"/>\n'
        '  </rdf:RDF>\n'
        '</x:xmpmeta>\n'
        '<?xpacket end="w"?>'
    )
    xmp_path.write_text(content, encoding='utf-8')
