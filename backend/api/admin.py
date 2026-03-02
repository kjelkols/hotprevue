import os
import pathlib
import subprocess

from fastapi import APIRouter, HTTPException
from fastapi.responses import Response

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/backup")
def create_backup():
    """Returnerer en pg_dump SQL-dump av hotprevue-databasen."""
    try:
        import pgserver
        pg_dump = pathlib.Path(pgserver.__file__).parent / "pginstall" / "bin" / "pg_dump"
    except ImportError:
        raise HTTPException(status_code=501, detail="pgserver ikke tilgjengelig")

    db_url = os.environ.get("DATABASE_URL", "")
    if not db_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL ikke satt")

    # pg_dump bruker plain postgresql://, ikke SQLAlchemy-dialekt
    plain_url = db_url.replace("postgresql+psycopg2://", "postgresql://")

    result = subprocess.run(
        [str(pg_dump), "--dbname", plain_url, "--no-password"],
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
