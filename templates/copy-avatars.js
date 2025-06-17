const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const AVATAR_DIR = path.join(ROOT_DIR, 'output', 'assets', 'avatar');

const BRACKET_REGEX = /【[^】]+】/;

function copyAvatarFiles() {
  const files = fs.readdirSync(AVATAR_DIR);

  files.forEach((file) => {
    const ext = path.extname(file);
    const base = path.basename(file, ext);

    if (BRACKET_REGEX.test(base)) {
      return;
    }

    const srcPath = path.join(AVATAR_DIR, file);
    const variants = ['金牌', '银牌', '黑牌'];

    variants.forEach((prefix) => {
      const newName = `${base}【${prefix}】${ext}`;
      const destPath = path.join(AVATAR_DIR, newName);

      if (!fs.existsSync(destPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`[复制] ${file} → ${newName}`);
      } 
    });
  });
}

copyAvatarFiles();