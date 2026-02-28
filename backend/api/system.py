import os
from pathlib import Path

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter(prefix="/system", tags=["system"])

# ─── Filtyper (speil av Electron-logikken) ───────────────────────────────────

MASTER_EXTS: dict[str, list[str]] = {
    "JPEG": [".jpg", ".jpeg"],
    "PNG":  [".png"],
    "TIFF": [".tif", ".tiff"],
    "HEIC": [".heic", ".heif"],
    "RAW":  [".nef", ".cr2", ".cr3", ".arw", ".dng", ".orf", ".rw2", ".pef"],
}
XMP_EXTS = [".xmp"]


def _all_known_exts() -> set[str]:
    return {ext for exts in MASTER_EXTS.values() for ext in exts} | set(XMP_EXTS)


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
