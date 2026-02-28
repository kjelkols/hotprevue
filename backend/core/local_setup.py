import os
import uuid
from pathlib import Path


def setup_local_environment() -> None:
    """Start pgserver og sett DATABASE_URL + COLDPREVIEW_DIR i os.environ.
    Må kalles før noen andre imports som bruker settings."""
    import pgserver
    import platformdirs

    data_dir = Path(os.environ.get("DATA_DIR") or platformdirs.user_data_dir("Hotprevue", appauthor=False))

    pgdata = data_dir / "pgdata"
    pgdata.mkdir(parents=True, exist_ok=True)

    coldpreviews = data_dir / "coldpreviews"
    coldpreviews.mkdir(parents=True, exist_ok=True)

    pg = pgserver.get_server(str(pgdata))

    _ensure_database(pg.get_uri(database="postgres"), "hotprevue")

    os.environ["DATABASE_URL"] = pg.get_uri(database="hotprevue")
    os.environ["COLDPREVIEW_DIR"] = str(coldpreviews)
    os.environ["HOTPREVUE_MACHINE_ID"] = str(_get_or_create_machine_id(data_dir))

    # Hold referanse slik at pgserver ikke GC-es
    import builtins
    builtins._pg_server = pg  # type: ignore[attr-defined]


def _get_or_create_machine_id(data_dir: Path) -> uuid.UUID:
    id_file = data_dir / "machine_id"
    if id_file.exists():
        return uuid.UUID(id_file.read_text().strip())
    new_id = uuid.uuid4()
    id_file.write_text(str(new_id))
    return new_id


def _ensure_database(base_uri: str, dbname: str) -> None:
    import psycopg2
    conn = psycopg2.connect(base_uri)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname = %s", (dbname,))
    if not cur.fetchone():
        cur.execute(f'CREATE DATABASE "{dbname}"')
    cur.close()
    conn.close()
