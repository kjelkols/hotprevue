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
