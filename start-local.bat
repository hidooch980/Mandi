@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ========================================================
echo   پترونبض - اجرای رایگان روی لپ‌تاپ و گوشی (بدون هاست)
echo ========================================================
echo.
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /C:"IPv4"') do (
    echo آدرس شبکه محلی برای باز کردن در گوشی (اندروید و آیفون) و لپ‌تاپ‌های وای‌فای:
    echo   http:%%a:3000
)
echo.
echo آدرس روی همین کامپیوتر:
echo   http://localhost:3000
echo.
echo اگر برای اولین بار اجرا می‌کنید، در حال آماده‌سازی...
if not exist ".next" (
    call npm run build
)
npx next start -H 0.0.0.0 -p 3000
pause
