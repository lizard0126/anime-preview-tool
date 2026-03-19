import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';

import { copyAvatarFiles } from './copy-avatars.js';
import { parseDocx } from './parseAnimeDocx.js';
import { generateHtml } from './generate-html.js';
import { takeScreenshots } from './screenshot-html.js';
import { deleteTempFile } from './del-temp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function processAnimePreview(config, logCallback) {
  const {
    docxPath,
    avatarFiles,
    outputDir
  } = config;

  await fs.ensureDir(outputDir);
  const avatarDir = path.join(outputDir, 'assets', 'avatar');
  await fs.emptyDir(avatarDir);
  if (avatarFiles && avatarFiles.length > 0) {
    for (const file of avatarFiles) {
      const dest = path.join(avatarDir, path.basename(file));
      await fs.copy(file, dest);
      logCallback(`已添加头像: ${path.basename(file)}`);
    }
  }

  logCallback('步骤1: 复制头像副本...');
  await copyAvatarFiles(avatarDir, logCallback);

  logCallback('步骤2: 解析 DOCX 文件...');
  const ttfDir = path.join(__dirname, 'fonts');
  const htmlDir = path.join(outputDir, 'assets');
  const animeData = await parseDocx(docxPath, htmlDir, ttfDir, logCallback);

  logCallback('步骤3: 生成 HTML...');
  const ejsDir = path.join(__dirname, 'page.ejs');
  await generateHtml(animeData, ejsDir, htmlDir, logCallback);

  logCallback('步骤4: 截图...');
  await takeScreenshots(htmlDir, outputDir, logCallback);

  logCallback('步骤5: 清理临时文件...');
  await deleteTempFile(htmlDir, logCallback);

  logCallback('处理完成！');
  return { outputDir };
}