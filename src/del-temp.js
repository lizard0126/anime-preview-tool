import fs from 'fs';
import path from 'path';

function deleteRecursive(folderPath, logCallback) {
  const items = fs.readdirSync(folderPath);
  items.forEach(item => {
    const itemPath = path.join(folderPath, item);
    if (fs.statSync(itemPath).isDirectory()) {
      deleteRecursive(itemPath, logCallback);
    } else {
      fs.unlinkSync(itemPath);
    }
  });
  fs.rmdirSync(folderPath);
  logCallback(`删除文件夹: ${folderPath}`);
}

export function deleteTempFile(assetsDir, logCallback) {
  deleteRecursive(assetsDir, logCallback);
}