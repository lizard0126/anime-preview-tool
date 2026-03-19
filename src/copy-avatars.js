import fs from 'fs';
import path from 'path';

export function copyAvatarFiles(avatarDir, logCallback) {
  const files = fs.readdirSync(avatarDir);
  files.forEach((file) => {
    const ext = path.extname(file);
    const base = path.basename(file, ext);
    const srcPath = path.join(avatarDir, file);
    const variants = ['金牌', '银牌', '黑牌'];

    variants.forEach((prefix) => {
      const newName = `${base}【${prefix}】${ext}`;
      const newName1 = `【${prefix}】${base}${ext}`;
      const destPath = path.join(avatarDir, newName);
      const destPath1 = path.join(avatarDir, newName1);

      fs.copyFileSync(srcPath, destPath);
      fs.copyFileSync(srcPath, destPath1);
    });
    logCallback(`复制头像文件：${file}`);
  });
}