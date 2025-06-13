@echo off
cd /d %~dp0
node parseAnimeDocx.js
node generate-html.js
node screenshot-html.js
exit