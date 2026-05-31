from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.registration import scan_directory, FileGroup

router = APIRouter(prefix="/scan", tags=["scan"])


class ScanRequest(BaseModel):
    path: str
    recursive: bool = True


class FileGroupOut(BaseModel):
    master: str
    companions: list[str]
    has_raw: bool
    has_jpeg: bool


class ScanResponse(BaseModel):
    groups: list[FileGroupOut]
    total_files: int


@router.post("", response_model=ScanResponse)
def scan(req: ScanRequest) -> ScanResponse:
    if not Path(req.path).exists():
        raise HTTPException(status_code=404, detail=f"Katalog finnes ikke: {req.path}")

    groups, total_files = scan_directory(req.path, recursive=req.recursive)

    return ScanResponse(
        groups=[
            FileGroupOut(
                master=str(g.master),
                companions=[str(c) for c in g.companions],
                has_raw=g.has_raw,
                has_jpeg=g.has_jpeg,
            )
            for g in groups
        ],
        total_files=total_files,
    )
