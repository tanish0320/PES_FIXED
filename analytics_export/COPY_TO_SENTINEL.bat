@echo off
REM Global Financial Intelligence Engine - Copy Script for Windows
REM Usage: COPY_TO_SENTINEL.bat "C:\path\to\Tanish-Sentinel"

if "%~1"=="" (
    echo.
    echo Analytics Export Copy Script
    echo Usage: COPY_TO_SENTINEL.bat "C:\path\to\Tanish-Sentinel"
    echo.
    echo Example:
    echo   COPY_TO_SENTINEL.bat "C:\Users\urbra\OneDrive\Desktop\Projects\Tanish-Sentinel"
    echo.
    pause
    exit /b 1
)

set TARGET_PATH=%~1

echo.
echo ========================================
echo Analytics Export Copy Script
echo ========================================
echo.
echo Target: %TARGET_PATH%
echo.

REM Check if target directory exists
if not exist "%TARGET_PATH%" (
    echo ERROR: Target directory does not exist!
    echo %TARGET_PATH%
    pause
    exit /b 1
)

echo Copying backend analytics modules...
xcopy /E /I /Y "%~dp0backend\app\analytics" "%TARGET_PATH%\backend\app\analytics"
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy backend modules
    pause
    exit /b 1
)
echo [OK] Backend modules copied

echo.
echo Copying frontend hook...
xcopy /Y "%~dp0frontend\src\hooks\useFinancialIntelligenceStore.js" "%TARGET_PATH%\frontend\src\hooks\"
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy frontend hook
    pause
    exit /b 1
)
echo [OK] Frontend hook copied

echo.
echo Copying frontend page...
xcopy /Y "%~dp0frontend\src\pages\FinancialIntelligence.jsx" "%TARGET_PATH%\frontend\src\pages\"
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy frontend page
    pause
    exit /b 1
)
echo [OK] Frontend page copied

echo.
echo Copying pre-populated database...
xcopy /Y "%~dp0database\analytics.db" "%TARGET_PATH%\backend\"
if %errorlevel% neq 0 (
    echo ERROR: Failed to copy database
    echo NOTE: You can skip this and let it auto-create, or copy it manually
    set /p continue="Continue anyway? (y/n): "
    if /i not "%continue%"=="y" exit /b 1
)
echo [OK] Database copied

echo.
echo ========================================
echo SUCCESS!
echo ========================================
echo.
echo All files copied. Now edit:
echo.
echo 1. backend\main.py
echo    (See MAIN_PY_PATCH.md for exact changes)
echo.
echo 2. frontend\src\App.jsx
echo    (See INTEGRATION_GUIDE.md for exact changes)
echo.
echo Then restart the server and test:
echo    curl http://localhost:8000/analytics/cycles
echo.
pause
