const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const AVATAR_DIR = path.join(ROOT_DIR, 'temp', 'assets', 'avatar');

function copyAvatarFiles() {
  const files = fs.readdirSync(AVATAR_DIR);

  files.forEach((file) => {
    const ext = path.extname(file);
    const base = path.basename(file, ext);

    const srcPath = path.join(AVATAR_DIR, file);
    const variants = ['金牌', '银牌', '黑牌'];

    variants.forEach((prefix) => {
      const newName = `${base}【${prefix}】${ext}`;
      const newName1 = `【${prefix}】${base}${ext}`;
      const destPath = path.join(AVATAR_DIR, newName);
      const destPath1 = path.join(AVATAR_DIR, newName1);

      fs.copyFileSync(srcPath, destPath);
      fs.copyFileSync(srcPath, destPath1);
    });
    console.log(`复制头像文件${file}`);
  });
}

copyAvatarFiles();