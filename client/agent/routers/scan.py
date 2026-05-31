from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from utils.registration import scan_directory, file_type_from_suffix

router = APIRouter(prefix="/scan", tags=["scan"])


class ScanRequest(BaseModel):
    path: str
    recursive: bool = True


class CompanionFileOut(BaseModel):
    path: str
    type: str


class FileGroupOut(BaseModel):
    master_path: str
    master_type: str
    companions: list[CompanionFileOut]


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
                master_path=str(g.master),
                master_type=file_type_from_suffix(g.master.suffix.lower()),
                companions=[
                    CompanionFileOut(
                        path=str(c),
                        type=file_type_from_suffix(c.suffix.lower()),
                    )
                    for c in g.companions
                ],
            )
            for g in groups
        ],
        total_files=total_files,
    )
