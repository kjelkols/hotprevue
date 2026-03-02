"""Starter og stopper backend-prosessen som en subprocess."""
from __future__ import annotations

import os
import queue
import subprocess
import sys
import threading
from pathlib import Path
from typing import Optional

APP_ROOT = Path(__file__).parent.parent
BACKEND_DIR = APP_ROOT / "backend"
_UVX = APP_ROOT / "uv.exe"


def _uv_exe() -> str:
    return str(_UVX) if _UVX.exists() else "uv"


class ServerManager:
    def __init__(self) -> None:
        self._proc: Optional[subprocess.Popen] = None
        self.log_queue: queue.Queue[str] = queue.Queue()

    def is_running(self) -> bool:
        return self._proc is not None and self._proc.poll() is None

    def start(self, port: int, data_dir: str, open_browser: bool) -> None:
        if self.is_running():
            return
        env = os.environ.copy()
        env["HOTPREVUE_LOCAL"] = "true"
        env["HOTPREVUE_FRONTEND_DIR"] = str(APP_ROOT / "frontend")
        if data_dir:
            env["DATA_DIR"] = data_dir
        if open_browser:
            env["HOTPREVUE_OPEN_BROWSER"] = "true"
        else:
            env.pop("HOTPREVUE_OPEN_BROWSER", None)

        creationflags = subprocess.CREATE_NO_WINDOW if sys.platform == "win32" else 0

        self._proc = subprocess.Popen(
            [_uv_exe(), "run", "--python", "3.12", "uvicorn", "main:app",
             "--host", "127.0.0.1", "--port", str(port)],
            cwd=str(BACKEND_DIR),
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            encoding="utf-8",
            errors="replace",
            creationflags=creationflags,
        )
        threading.Thread(target=self._stream_log, daemon=True).start()

    def stop(self) -> None:
        if self._proc and self._proc.poll() is None:
            self._proc.terminate()
            try:
                self._proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                self._proc.kill()
        self._proc = None

    def _stream_log(self) -> None:
        assert self._proc and self._proc.stdout
        for line in self._proc.stdout:
            self.log_queue.put(line.rstrip("\n"))
        self.log_queue.put("--- prosessen er avsluttet ---")
