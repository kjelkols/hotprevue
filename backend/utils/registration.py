"""File grouping and classification for input session scanning."""

from dataclasses import dataclass, field
from pathlib import Path

RAW_EXTENSIONS = {".cr2", ".cr3", ".nef", ".arw", ".orf", ".rw2", ".dng", ".raf", ".pef", ".srw"}
JPEG_EXTENSIONS = {".jpg", ".jpeg"}
OTHER_IMAGE_EXTENSIONS = {".png", ".tiff", ".tif", ".heic", ".heif"}
SIDECAR_EXTENSIONS = {".xmp"}
KNOWN_EXTENSIONS = RAW_EXTENSIONS | JPEG_EXTENSIONS | OTHER_IMAGE_EXTENSIONS | SIDECAR_EXTENSIONS


@dataclass
class FileGroup:
    master: Path          # Source file for hotpreview and EXIF
    companions: list[Path] = field(default_factory=list)
    has_raw: bool = False
    has_jpeg: bool = False


def scan_directory(source_path: str, recursive: bool = True) -> tuple[list[FileGroup], int]:
    """Walk a directory and return (file_groups, unknown_file_count).

    Groups files by (directory, stem) — e.g. IMG_1234.CR2 and IMG_1234.JPG
    become one group. Master is RAW if present, else the first JPEG/other.
    Unknown file types are counted but not grouped.
    """
    root = Path(source_path)
    if not root.exists():
        raise ValueError(f"Path does not exist: {source_path}")

    pattern = "**/*" if recursive else "*"
    all_files = [p for p in root.glob(pattern) if p.is_file()]

    groups_dict: dict[str, list[Path]] = {}
    unknown_count = 0

    for path in all_files:
        suffix = path.suffix.lower()
        if suffix not in KNOWN_EXTENSIONS:
            unknown_count += 1
            continue
        key = str(path.parent).lower() + "/" + path.stem.lower()
        groups_dict.setdefault(key, []).append(path)

    result: list[FileGroup] = []
    for files in groups_dict.values():
        raws = [f for f in files if f.suffix.lower() in RAW_EXTENSIONS]
        jpegs = [f for f in files if f.suffix.lower() in JPEG_EXTENSIONS]
        others = [f for f in files if f.suffix.lower() in OTHER_IMAGE_EXTENSIONS]

        image_files = raws + jpegs + others
        if not image_files:
            continue  # Only sidecars — skip

        master = raws[0] if raws else (jpegs + others)[0]
        companions = [f for f in files if f != master]

        result.append(FileGroup(
            master=master,
            companions=companions,
            has_raw=bool(raws),
            has_jpeg=bool(jpegs),
        ))

    return result, unknown_count


def file_type_from_suffix(suffix: str) -> str:
    """Map a file extension (with dot, lowercase) to an ImageFile.file_type string."""
    if suffix in RAW_EXTENSIONS:
        return "RAW"
    if suffix in JPEG_EXTENSIONS:
        return "JPEG"
    if suffix == ".png":
        return "PNG"
    if suffix in {".tiff", ".tif"}:
        return "TIFF"
    if suffix in {".heic", ".heif"}:
        return "HEIC"
    if suffix in SIDECAR_EXTENSIONS:
        return "XMP"
    return "JPEG"
