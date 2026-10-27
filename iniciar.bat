@echo off
chcp 65001 >nul
title Extrator Google Maps
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo Node.js nao encontrado. Instale em https://nodejs.org e rode este arquivo de novo.
  pause
  exit /b 1
)

if not exist node_modules (
  echo Instalando dependencias pela primeira vez...
  call npm install --no-fund --no-audit
)

rem porta: variavel do sistema > arquivo .env > 3210
if not defined PORTA if exist .env for /f "tokens=1,* delims==" %%a in ('findstr /b /c:"PORTA=" .env') do set PORTA=%%b
if not defined PORTA set PORTA=3210
echo Abrindo http://localhost:%PORTA% ...
start "" /b cmd /c "ping -n 3 127.0.0.1 >nul & start msedge --app=http://localhost:%PORTA% || start http://localhost:%PORTA%"
echo Feche esta janela para encerrar o extrator.
node src\servidor.js
pause
