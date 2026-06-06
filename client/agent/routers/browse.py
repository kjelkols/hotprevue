import os
import platform
from concurrent.futures import ThreadPoolExecutor, as_completed
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
    image_count: int = 0


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


def _read_proc_mounts() -> dict[str, str]:
    """Returnerer {monteringspunkt: filsystemtype} fra /proc/mounts."""
    result: dict[str, str] = {}
    try:
        with open("/proc/mounts") as f:
            for line in f:
                parts = line.split()
                if len(parts) >= 3:
                    result[parts[1]] = parts[2]
    except OSError:
        pass
    return result


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
        ] if user else [Path("/media"), Path("/mnt")]

        # Filsystemtyper typisk for minnekort og USB-disker.
        # Ekskluderer NFS, ext4, btrfs, tmpfs og andre systemmonteringer.
        removable_fs = {"vfat", "exfat", "ntfs", "ntfs-3g", "msdos", "fuseblk", "fuse.exfat"}
        fs_by_mountpoint = _read_proc_mounts()

        seen: set[str] = set()
        for base in candidates:
            if not base.exists() or not base.is_dir():
                continue
            try:
                for p in sorted(base.iterdir()):
                    if p.name.startswith(".") or not p.is_dir():
                        continue
                    fs_type = fs_by_mountpoint.get(str(p), "")
                    if fs_type not in removable_fs:
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


def _count_images(dir_path: str) -> int:
    try:
        with os.scandir(dir_path) as it:
            return sum(
                1 for e in it
                if e.is_file() and Path(e.name).suffix.lower() in IMAGE_SUFFIXES
            )
    except OSError:
        return 0


@router.get("", response_model=BrowseResult)
def browse(path: str = Query(default="")) -> BrowseResult:
    p = Path(path).expanduser() if path else Path.home()

    if not p.exists() or not p.is_dir():
        p = Path.home()

    dir_entries: list[Path] = []
    files: list[BrowseFile] = []

    try:
        entries = sorted(p.iterdir(), key=lambda e: (e.is_file(), e.name.lower()))
        for entry in entries:
            if entry.name.startswith("."):
                continue
            if entry.is_dir():
                dir_entries.append(entry)
            elif entry.is_file() and entry.suffix.lower() in IMAGE_SUFFIXES:
                files.append(BrowseFile(
                    name=entry.name,
                    path=str(entry),
                    type=file_type_from_suffix(entry.suffix.lower()),
                ))
    except PermissionError:
        pass

    # Tell bilder i alle undermapper parallelt — cloud/FUSE-mapper kan henge sekvensielt
    counts: dict[str, int] = {str(e): 0 for e in dir_entries}
    if dir_entries:
        with ThreadPoolExecutor(max_workers=min(16, len(dir_entries))) as pool:
            futures = {pool.submit(_count_images, str(e)): str(e) for e in dir_entries}
            for future in as_completed(futures, timeout=2.0):
                counts[futures[future]] = future.result()

    dirs = [
        BrowseDir(name=e.name, path=str(e), image_count=counts[str(e)])
        for e in dir_entries
    ]

    parent = str(p.parent) if p != p.parent else None

    return BrowseResult(path=str(p), parent=parent, dirs=dirs, files=files)
