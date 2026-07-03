@echo off
rem LESTER HARVEY — portfolio demo launcher
rem Double-click to serve the site on http://localhost:4173
cd /d "%~dp0"
start "" http://localhost:4173
py -m http.server 4173 2>nul || python -m http.server 4173
