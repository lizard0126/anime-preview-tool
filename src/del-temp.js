import fs from 'fs';
import path from 'path';

function deleteFolderSync(folderPath, logCallback) {
  const items = fs.readdirSync(folderPath);
  items.forEach(item => {
    const itemPath = path.join(folderPath, item);
    const stat = fs.statSync(itemPath);
    if (stat.isDirectory()) {
      deleteFolderSync(itemPath, logCallback);
    } else {
      fs.unlinkSync(itemPath);
    }
  });
  fs.rmdirSync(folderPath);
  logCallback(`删除文件夹: ${folderPath}`);
}

export function deleteTempFile(assetsDir, logCallback) {
deleteFolderSync(assetsDir, logCallback);
}