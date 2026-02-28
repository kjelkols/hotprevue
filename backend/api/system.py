import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/system", tags=["system"])

# ─── Filtyper ────────────────────────────────────────────────────────────────

MASTER_EXTS: dict[str, list[str]] = {
    "JPEG": [".jpg", ".jpeg"],
    "PNG":  [".png"],
    "TIFF": [".tif", ".tiff"],
    "HEIC": [".heic", ".heif"],
    "RAW":  [".nef", ".cr2", ".cr3", ".arw", ".dng", ".orf", ".rw2", ".pef"],
}
XMP_EXTS = [".xmp"]


def _master_exts() -> set[str]:
    return {ext for exts in MASTER_EXTS.values() for ext in exts}


def _all_known_exts() -> set[str]:
    return _master_exts() | set(XMP_EXTS)


def _get_type(path: str) -> str:
    ext = Path(path).suffix.lower()
    for type_name, exts in MASTER_EXTS.items():
        if ext in exts:
            return type_name
    return "XMP" if ext in XMP_EXTS else "UNKNOWN"


def _collect_files(dir_path: str, recursive: bool) -> list[str]:
    result = []
    with os.scandir(dir_path) as it:
        for entry in it:
            if entry.is_dir(follow_symlinks=False) and recursive:
                result.extend(_collect_files(entry.path, recursive))
            elif entry.is_file():
                result.append(entry.path)
    return result


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
    all_files = _collect_files(req.path, req.recursive)
    known = _all_known_exts()
    relevant = [f for f in all_files if Path(f).suffix.lower() in known]

    by_stem: dict[str, list[str]] = {}
    for f in relevant:
        by_stem.setdefault(Path(f).stem.lower(), []).append(f)

    groups: list[FileGroup] = []
    for paths in by_stem.values():
        def of_type(type_key: str) -> list[str]:
            return [p for p in paths if Path(p).suffix.lower() in MASTER_EXTS[type_key]]

        candidates = [
            *of_type("JPEG"), *of_type("PNG"), *of_type("TIFF"),
            *of_type("HEIC"), *of_type("RAW"),
        ]
        if not candidates:
            continue

        xmps = [p for p in paths if Path(p).suffix.lower() in XMP_EXTS]
        master = candidates[0]
        companions = (
            [CompanionFile(path=p, type=_get_type(p)) for p in candidates[1:]]
            + [CompanionFile(path=p, type="XMP") for p in xmps]
        )
        groups.append(FileGroup(
            master_path=master,
            master_type=_get_type(master),
            companions=companions,
        ))

    return ScanResult(groups=groups, total_files=len(all_files))


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
    exts = _master_exts()

    dirs: list[BrowseDir] = []
    files: list[BrowseFile] = []

    try:
        entries = sorted(p.iterdir(), key=lambda e: (not e.is_dir(), e.name.lower()))
        for entry in entries:
            if entry.is_dir(follow_symlinks=False):
                if _dir_has_images(str(entry), exts):
                    dirs.append(BrowseDir(name=entry.name, path=str(entry)))
            elif entry.is_file() and entry.suffix.lower() in exts:
                files.append(BrowseFile(name=entry.name, path=str(entry), type=_get_type(str(entry))))
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
