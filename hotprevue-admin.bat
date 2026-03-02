@echo off
setlocal

set UV_PYTHON_INSTALL_DIR=%~dp0runtime\python
set UV_CACHE_DIR=%~dp0runtime\uv-cache

cd /d "%~dp0backend"
"%~dp0uv.exe" run --python 3.12 python "..\admin\console.py"

endlocal
