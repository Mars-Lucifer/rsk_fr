@echo off
setlocal

cd /d "%~dp0"

set "PYTHON_CMD=python"
where python >nul 2>nul
if errorlevel 1 (
  set "PYTHON_CMD=py -3"
)

echo [1/3] Checking Python dependencies...
%PYTHON_CMD% -c "from playwright.sync_api import sync_playwright" >nul 2>nul
if errorlevel 1 (
  echo Installing Playwright dependency...
  %PYTHON_CMD% -m pip install -r scripts\qwen\requirements.txt
  if errorlevel 1 goto fail
)

echo [2/3] Refreshing Qwen tokens from local browser sessions...
%PYTHON_CMD% scripts\qwen\qwen_sessions.py refresh-all --show-token
if errorlevel 1 goto fail

echo [3/3] Applying refreshed tokens to data\mayak-settings.json...
%PYTHON_CMD% scripts\qwen\apply_token_cache.py
if errorlevel 1 goto fail

set "DESKTOP_EXPORT=%USERPROFILE%\Desktop\Qwen tokens update"
if exist "%DESKTOP_EXPORT%\" (
  copy /Y "data\mayak-settings.json" "%DESKTOP_EXPORT%\mayak-settings.json" >nul
)

echo.
echo Done. Upload this file in /admin/mayak-ai-tokens using "Import JSON":
echo   mayak-settings.json
exit /b 0

:fail
echo.
echo Qwen token update failed.
exit /b 1
