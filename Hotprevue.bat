@echo off
setlocal

set HOTPREVUE_LOCAL=true
set HOTPREVUE_OPEN_BROWSER=true
set HOTPREVUE_FRONTEND_DIR=%~dp0frontend

cd /d "%~dp0backend"
"%~dp0uv.exe" run --python 3.12 uvicorn main:app --host 127.0.0.1 --port 8000

endlocal
