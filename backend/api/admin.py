import os
import shutil
import subprocess

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/backup")
def create_backup():
    """Returnerer en pg_dump SQL-dump av hotprevue-databasen."""
    pg_dump = shutil.which("pg_dump")
    if not pg_dump:
        raise HTTPException(status_code=501, detail="pg_dump ikke funnet i PATH")

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL ikke satt")

    plain_url = db_url.replace("postgresql+psycopg2://", "postgresql://")

    result = subprocess.run(
        [pg_dump, "--dbname", plain_url, "--no-password"],
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    if result.returncode != 0:
        raise HTTPException(status_code=500, detail=result.stderr)

    return Response(
        content=result.stdout.encode("utf-8"),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": 'attachment; filename="hotprevue-backup.sql"'},
    )
