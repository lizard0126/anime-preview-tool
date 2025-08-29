@echo off
node templates/copy-avatars.js
node templates/parseAnimeDocx.js
node templates/generate-html.js
node templates/screenshot-html.js
node templates/del-avatars.js
exit