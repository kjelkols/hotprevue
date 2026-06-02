"""Lokale filoperasjoner for Preorganisering.

Endepunkter:
  POST /files/move    — flytt en bildegruppe (master + companions) til ny katalog
  POST /files/mkdir   — lag ny katalog
"""

import shutil
from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.registration import scan_directory
from agent.routers.prescan import update_cache_path, remove_from_cache

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


@router.post("/mkdir", response_model=MkdirResult)
def make_dir(req: MkdirRequest) -> MkdirResult:
    p = Path(req.path)
    try:
        p.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Kunne ikke lage katalog: {e}")
    return MkdirResult(path=str(p))


def _move_file(src: Path, dst: Path) -> None:
    """Flytt fil — os.rename hvis samme filesystem (atomisk), shutil.move ellers."""
    try:
        src.rename(dst)
    except OSError:
        shutil.move(str(src), str(dst))
