@echo off
node code/copy-avatars.js
node code/parseAnimeDocx.js
node code/generate-html.js
node code/screenshot-html.js
node code/del-avatars.js
exit