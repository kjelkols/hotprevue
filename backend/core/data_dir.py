"""Data directory — resolves and owns the internal path structure.

All code that needs a path under the application data directory must go
through this module. The internal structure (which subdirectory holds what)
is an implementation detail of this module alone — callers use named
properties and are unaffected if the layout changes.

Usage:
    from core.data_dir import DataDir

    dd = DataDir.resolve()    # reads DATA_DIR env var or platformdirs default
    dd.ensure_dirs()          # create subdirectories if missing
    dd.coldpreviews           # Path to coldpreview directory
    dd.pgdata                 # Path to PostgreSQL data directory
    dd.machine_id()           # UUID — read from disk, created on first call
"""

import os
import uuid
from pathlib import Path


class DataDir:
    def __init__(self, root: Path) -> None:
        self._root = root

    @property
    def root(self) -> Path:
        return self._root

    @property
    def pgdata(self) -> Path:
        return self._root / "pgdata"

    @property
    def coldpreviews(self) -> Path:
        return self._root / "coldpreviews"

    @property
    def _machine_id_file(self) -> Path:
        return self._root / "machine_id"

    def machine_id(self) -> uuid.UUID:
        """Return the machine UUID, creating and persisting it on first call."""
        if self._machine_id_file.exists():
            return uuid.UUID(self._machine_id_file.read_text().strip())
        new_id = uuid.uuid4()
        self._machine_id_file.write_text(str(new_id))
        return new_id

    def ensure_dirs(self) -> None:
        """Create all required subdirectories if they do not exist."""
        self.pgdata.mkdir(parents=True, exist_ok=True)
        self.coldpreviews.mkdir(parents=True, exist_ok=True)

    @classmethod
    def resolve(cls) -> "DataDir":
        """Resolve root from DATA_DIR env var, falling back to platformdirs."""
        import platformdirs
        root = Path(
            os.environ.get("DATA_DIR")
            or platformdirs.user_data_dir("Hotprevue", appauthor=False)
        )
        return cls(root)
