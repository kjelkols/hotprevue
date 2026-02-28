import os
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.registration import (
    KNOWN_EXTENSIONS,
    file_type_from_suffix,
    scan_directory as _scan_directory,
)

router = APIRouter(prefix="/system", tags=["system"])


# ─── Skann katalog ────────────────────────────────────────────────────────────

class CompanionFile(BaseModel):
    path: str
    type: str


class FileGroup(BaseModel):
    master_path: str
    master_type: str
    companions: list[CompanionFile]


class ScanResult(BaseModel):
    groups: list[FileGroup]
    total_files: int


class ScanRequest(BaseModel):
    path: str
    recursive: bool = True


@router.post("/scan-directory", response_model=ScanResult)
def scan_directory(req: ScanRequest):
    try:
        internal_groups, total_files = _scan_directory(req.path, req.recursive)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    groups = []
    for g in internal_groups:
        master_type = file_type_from_suffix(g.master.suffix.lower())
        companions = [
            CompanionFile(path=str(c), type=file_type_from_suffix(c.suffix.lower()))
            for c in g.companions
        ]
        groups.append(FileGroup(
            master_path=str(g.master),
            master_type=master_type,
            companions=companions,
        ))

    return ScanResult(groups=groups, total_files=total_files)


# ─── Filbrowser ───────────────────────────────────────────────────────────────

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


def _dir_has_images(dir_path: str, exts: set[str], depth: int = 0) -> bool:
    if depth > 10:
        return False
    try:
        with os.scandir(dir_path) as it:
            for entry in it:
                if entry.is_file() and Path(entry.path).suffix.lower() in exts:
                    return True
                if entry.is_dir(follow_symlinks=False) and _dir_has_images(entry.path, exts, depth + 1):
                    return True
    except OSError:
        pass
    return False


@router.get("/browse", response_model=BrowseResult)
def browse_directory(path: str = ""):
    p = Path(path) if path else Path.home()
    parent = str(p.parent) if p.parent != p else None
    image_exts = KNOWN_EXTENSIONS - {".xmp"}

    dirs: list[BrowseDir] = []
    files: list[BrowseFile] = []

    try:
        entries = sorted(p.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        for entry in entries:
            if entry.is_dir(follow_symlinks=False):
                if _dir_has_images(str(entry), image_exts):
                    dirs.append(BrowseDir(name=entry.name, path=str(entry)))
            elif entry.is_file() and entry.suffix.lower() in image_exts:
                files.append(BrowseFile(
                    name=entry.name,
                    path=str(entry),
                    type=file_type_from_suffix(entry.suffix.lower()),
                ))
    except OSError:
        pass

    return BrowseResult(path=str(p), parent=parent, dirs=dirs, files=files)


# ─── Velg katalog (native dialog) ─────────────────────────────────────────────

class PickResult(BaseModel):
    path: str | None


@router.post("/pick-directory", response_model=PickResult)
def pick_directory():
    try:
        import tkinter as tk
        from tkinter import filedialog
        root = tk.Tk()
        root.withdraw()
        root.attributes("-topmost", True)
        path = filedialog.askdirectory(parent=root, title="Velg katalog")
        root.destroy()
        return PickResult(path=path or None)
    except Exception:
        return PickResult(path=None)
