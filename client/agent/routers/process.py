from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

router = APIRouter(prefix="/process", tags=["process"])


class ProcessRequest(BaseModel):
    master: str
    companions: list[str] = []


class ProcessResponse(BaseModel):
    hothash: str
    hotpreview_b64: str
    coldpreview_b64: str
    exif: dict
    width: int
    height: int


@router.post("", response_model=ProcessResponse)
def process(req: ProcessRequest) -> ProcessResponse:
    # TODO: implementer i neste steg
    raise HTTPException(status_code=501, detail="Ikke implementert ennå")
