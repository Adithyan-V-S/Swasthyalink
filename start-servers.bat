@echo off
echo Starting Swasthyalink Servers...
echo.

REM Start Backend
start "Swasthyalink Backend" cmd /k "cd /d d:\Swasthyalink\backend && npm start"

REM Wait 3 seconds
timeout /t 3 /nobreak > nul

REM Start Frontend
start "Swasthyalink Frontend" cmd /k "cd /d d:\Swasthyalink\build-frontend && npm run dev"

echo.
echo Both servers are starting in separate windows!
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5174
pause
