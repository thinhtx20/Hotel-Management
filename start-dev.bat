@echo off
chcp 65001 >nul
title Hotel Management Backend Launcher
echo =========================================================
echo       HOTEL MANAGEMENT BACKEND - KHỞI ĐỘNG DỰ ÁN
echo =========================================================
echo.
echo [1/2] Đang kiểm tra & khởi động PostgreSQL...
tasklist /FI "IMAGENAME eq postgres.exe" 2>NUL | find /I /N "postgres.exe">NUL
if "%ERRORLEVEL%"=="0" (
    echo   -^> [OK] PostgreSQL đang chạy trên cổng 5432.
) else (
    start "" /B "D:\pgsql\bin\postgres.exe" -D "D:\pgsql\data"
    timeout /t 2 /nobreak >nul
    echo   -^> [OK] Đã khởi động PostgreSQL thành công!
)

echo.
echo [2/2] Đang khởi động máy chủ NestJS...
echo   -^> Swagger API Docs : http://localhost:3000/api/docs
echo   -^> Base API URL     : http://localhost:3000/api/v1
echo =========================================================
echo.
npm run start:dev

