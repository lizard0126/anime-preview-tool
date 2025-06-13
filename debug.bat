@echo off
cd /d %~dp0
node generate-html.js
node screenshot-html.js
exit