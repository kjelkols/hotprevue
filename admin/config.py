"""Lese og skrive hotprevue.json fra app-roten."""
from __future__ import annotations

import json
from dataclasses import asdict, dataclass, fields
from pathlib import Path

APP_ROOT = Path(__file__).parent.parent
_CONFIG_FILE = APP_ROOT / "hotprevue.json"

_FIELD_NAMES = None


def _field_names() -> set[str]:
    global _FIELD_NAMES
    if _FIELD_NAMES is None:
        _FIELD_NAMES = {f.name for f in fields(Config)}
    return _FIELD_NAMES


@dataclass
class Config:
    port: int = 8000
    data_dir: str = ""        # tom = platformdirs-standard
    open_browser: bool = True


def load() -> Config:
    if _CONFIG_FILE.exists():
        try:
            data = json.loads(_CONFIG_FILE.read_text(encoding="utf-8"))
            known = {k: v for k, v in data.items() if k in _field_names()}
            return Config(**known)
        except Exception:
            pass
    return Config()


def save(cfg: Config) -> None:
    _CONFIG_FILE.write_text(
        json.dumps(asdict(cfg), indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
