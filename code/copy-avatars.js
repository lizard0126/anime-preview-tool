import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const AVATAR_DIR = path.join(ROOT_DIR, 'temp', 'assets', 'avatar');

function copyAvatarFiles() {
  if (!fs.existsSync(AVATAR_DIR)) {
    console.error('头像目录不存在，请先创建并放入头像文件');
    process.exit(1);
  }

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
    console.log(`复制头像文件：${file}`);
  });
}

copyAvatarFiles();