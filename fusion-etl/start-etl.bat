@echo off
setlocal

set "NODE_DIR=C:\Users\jose.garcia\Desktop\Carlos\node-v24.15.0-win-x64"
set "PATH=%NODE_DIR%;%PATH%"

cd /d "%~dp0"

rem Roda em foreground (sem "start") de proposito: a Tarefa Agendada do
rem Windows so consegue detectar falha/reiniciar se o processo do .bat
rem ficar "preso" ao node.exe ate ele cair.
"%NODE_DIR%\node.exe" start.js

exit /b %ERRORLEVEL%
