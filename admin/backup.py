"""Henter SQL-dump fra den kjørende backend."""
from __future__ import annotations

import urllib.error
import urllib.request


def fetch_backup(port: int) -> bytes:
    """Returnerer rå SQL-bytes fra /admin/backup-endepunktet."""
    url = f"http://127.0.0.1:{port}/admin/backup"
    try:
        with urllib.request.urlopen(url, timeout=120) as resp:
            return resp.read()
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"HTTP {e.code}: {body}") from e
