"""Hotprevue lokal agent — kjører på klientmaskinen (port 8002).

Håndterer katalogskanning og bildeprosessering lokalt, slik at
originalfiler aldri forlater klientmaskinen.
"""

import sys
from pathlib import Path

# Gjør backend/utils tilgjengelig uten å flytte filer
sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "backend"))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from agent.routers import browse, copy, scan, process, prescan, files

app = FastAPI(title="Hotprevue Agent", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(browse.router)
app.include_router(copy.router)
app.include_router(scan.router)
app.include_router(process.router)
app.include_router(prescan.router)
app.include_router(files.router)


@app.get("/health")
def health() -> dict:
    import socket
    return {"status": "ok", "hostname": socket.gethostname()}
