@echo off
title English Levels
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nu este instalat. Instaleaza-l de la https://nodejs.org si incearca din nou.
  pause
  exit /b 1
)

rem Daca aplicatia ruleaza deja, doar o deschidem in browser.
curl -s -m 2 http://localhost:4747/api/ping 2>nul | find "english-levels" >nul
if not errorlevel 1 (
  start "" http://localhost:4747
  exit /b 0
)

rem --watch: serverul reporneste singur de fiecare data cand este actualizat.
node --watch server.js --open
if errorlevel 1 pause
