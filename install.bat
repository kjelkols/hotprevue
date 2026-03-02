@echo off
setlocal

cd /d "%~dp0backend"
"%~dp0uv.exe" run --python 3.12 python installer.py --root "%~dp0"

endlocal
