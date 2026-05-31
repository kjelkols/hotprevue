import os
import platform
from pathlib import Path

from fastapi import APIRouter, Query
from pydantic import BaseModel

from utils.registration import file_type_from_suffix

router = APIRouter(prefix="/browse", tags=["browse"])

IMAGE_SUFFIXES = {
    ".jpg", ".jpeg", ".png", ".gif", ".webp", ".tiff", ".tif",
    ".dng", ".cr2", ".cr3", ".nef", ".arw", ".orf", ".raf", ".rw2",
    ".heic", ".heif", ".avif",
}


class BrowseDir(BaseModel):
    name: str
    path: str


class BrowseFile(BaseModel):
    name: str
    path: str
    type: str


class BrowseResult(BaseModel):
    path: str
    parent: str | None
    dirs: list[BrowseDir]
    files: list[BrowseFile]


class VolumeEntry(BaseModel):
    name: str
    path: str


@router.get("/volumes", response_model=list[VolumeEntry])
def list_volumes() -> list[VolumeEntry]:
    system = platform.system()
    volumes: list[VolumeEntry] = []

    if system == "Darwin":
        base = Path("/Volumes")
        if base.exists():
            for p in sorted(base.iterdir()):
                if p.name.startswith(".") or not p.is_dir():
                    continue
                try:
                    if str(p.resolve()) != "/":
                        volumes.append(VolumeEntry(name=p.name, path=str(p)))
                except OSError:
                    pass

    elif system == "Linux":
        user = os.environ.get("USER") or os.environ.get("LOGNAME") or ""
        candidates = [
            Path(f"/media/{user}"),
            Path(f"/run/media/{user}"),
            Path("/media"),
            Path("/mnt"),
        ]
        seen: set[str] = set()
        for base in candidates:
            if not base.exists() or not base.is_dir():
                continue
            try:
                for p in sorted(base.iterdir()):
                    if p.name.startswith(".") or not p.is_dir():
                        continue
                    key = str(p.resolve())
                    if key not in seen:
                        seen.add(key)
                        volumes.append(VolumeEntry(name=p.name, path=str(p)))
            except PermissionError:
                pass

    elif system == "Windows":
        import string
        for letter in string.ascii_uppercase[2:]:  # skip A: and B:
            drive = Path(f"{letter}:/")
            if drive.exists():
                volumes.append(VolumeEntry(name=f"{letter}:", path=str(drive)))

    return volumes


@router.get("", response_model=BrowseResult)
def browse(path: str = Query(default="")) -> BrowseResult:
    p = Path(path).expanduser() if path else Path.home()

    if not p.exists() or not p.is_dir():
        p = Path.home()

    dirs: list[BrowseDir] = []
    files: list[BrowseFile] = []

    try:
        entries = sorted(p.iterdir(), key=lambda e: (e.is_file(), e.name.lower()))
        for entry in entries:
            if entry.name.startswith("."):
                continue
            if entry.is_dir():
                dirs.append(BrowseDir(name=entry.name, path=str(entry)))
            elif entry.is_file() and entry.suffix.lower() in IMAGE_SUFFIXES:
                files.append(BrowseFile(
                    name=entry.name,
                    path=str(entry),
                    type=file_type_from_suffix(entry.suffix.lower()),
                ))
    except PermissionError:
        pass

    parent = str(p.parent) if p != p.parent else None

    return BrowseResult(path=str(p), parent=parent, dirs=dirs, files=files)
