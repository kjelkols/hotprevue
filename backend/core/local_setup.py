"""Local setup — starts pgserver and populates environment variables.

Must be called before any other imports that use settings.
"""

import os

from core.data_dir import DataDir


def setup_local_environment() -> None:
    import pgserver

    dd = DataDir.resolve()
    dd.ensure_dirs()

    pg = pgserver.get_server(str(dd.pgdata))
    _ensure_database(pg.get_uri(database="postgres"), "hotprevue")

    os.environ["DATABASE_URL"] = pg.get_uri(database="hotprevue")
    os.environ["COLDPREVIEW_DIR"] = str(dd.coldpreviews)
    os.environ["HOTPREVUE_MACHINE_ID"] = str(dd.machine_id())

    # Hold referanse slik at pgserver ikke GC-es
    import builtins
    builtins._pg_server = pg  # type: ignore[attr-defined]


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
