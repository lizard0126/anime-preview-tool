import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const AVATAR_DIR = path.join(ROOT_DIR, 'temp', 'assets', 'avatar');

const COPY_REGEX = /【(金牌|银牌|黑牌)】/;

function deleteAvatarCopies() {
  if (!fs.existsSync(AVATAR_DIR)) {
    console.log('头像目录不存在，无需删除');
    return;
  }

  const files = fs.readdirSync(AVATAR_DIR);

  files.forEach((file) => {
    if (COPY_REGEX.test(file)) {
      const filePath = path.join(AVATAR_DIR, file);
      fs.unlinkSync(filePath);
    }
  });
}

deleteAvatarCopies();