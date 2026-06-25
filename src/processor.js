import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { generateHtml } from './generate-html.js';
import { takeScreenshots } from './screenshot-html.js';
import { deleteTempFile } from './del-temp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 获取字体目录（兼容开发环境和打包环境）
function getFontDir() {
  // 开发环境
  const devFontDir = path.join(__dirname, 'fonts');
  if (fs.existsSync(devFontDir)) return devFontDir;
  
  // 打包环境
  const prodFontDir = path.join(process.resourcesPath, 'fonts');
  if (fs.existsSync(prodFontDir)) return prodFontDir;
  
  return devFontDir;
}

export async function processAnimePreview(config, logCallback) {
  const { data, outputDir } = config;
  
  await fs.ensureDir(outputDir);
  const assetsDir = path.join(outputDir, 'assets');
  await fs.ensureDir(assetsDir);

  logCallback('步骤1: 准备素材...');
  await prepareAssets(data, assetsDir, logCallback);

  const selectedData = data.filter(a => a.selected !== false);
  logCallback(`步骤2: 处理 ${selectedData.length}/${data.length} 部选中的动画`);

  logCallback('步骤3: 生成 HTML...');
  await generateHtml(selectedData, path.join(__dirname, 'page.ejs'), assetsDir, logCallback);

  logCallback('步骤4: 截图...');
  await takeScreenshots(assetsDir, outputDir, logCallback);

  logCallback('步骤5: 清理临时文件...');
  await deleteTempFile(assetsDir, logCallback);

  logCallback('处理完成！');
  return { outputDir };
}

async function prepareAssets(data, assetsDir, logCallback) {
  const avatarDir = path.join(assetsDir, 'avatar');
  const visualDir = path.join(assetsDir, 'visual');
  const fontDir = path.join(assetsDir, 'fonts');
  
  await fs.ensureDir(avatarDir);
  await fs.ensureDir(visualDir);
  await fs.ensureDir(fontDir);

  // 复制字体文件 - 使用 getFontDir()
  const srcFontDir = getFontDir();
  logCallback(`  字体源目录: ${srcFontDir}`);
  logCallback(`  字体目录是否存在: ${fs.existsSync(srcFontDir)}`);

  if (fs.existsSync(srcFontDir)) {
    try {
      const files = fs.readdirSync(srcFontDir);
      logCallback(`  发现 ${files.length} 个文件`);
      for (const file of files) {
        if (['.ttf', '.otf', '.woff', '.woff2'].includes(path.extname(file))) {
          const destPath = path.join(fontDir, file);
          if (!fs.existsSync(destPath)) {
            fs.copyFileSync(path.join(srcFontDir, file), destPath);
            logCallback(`  复制字体: ${file}`);
          }
        }
      }
    } catch (err) {
      logCallback(`  字体复制失败: ${err.message}`);
    }
  } else {
    logCallback('  警告: 字体目录不存在');
  }

  for (const anime of data) {
    // 处理视觉图
    if (anime.visual) {
      try {
        if (anime.visual.startsWith('http')) {
          const res = await axios.get(anime.visual, { responseType: 'arraybuffer', timeout: 30000 });
          const ext = res.headers['content-type'].includes('png') ? '.png' : '.jpg';
          const name = `visual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
          await fs.writeFile(path.join(visualDir, name), res.data);
          anime.visual = `visual/${name}`;
        } else if (await fs.pathExists(anime.visual)) {
          const name = path.basename(anime.visual);
          const dest = path.join(visualDir, name);
          if (!await fs.pathExists(dest)) await fs.copy(anime.visual, dest);
          anime.visual = `visual/${name}`;
        }
      } catch (err) {
        logCallback(`  视觉图处理失败: ${err.message}`);
        anime.visual = '';
      }
    }

    // 处理头像
    if (anime.comments) {
      for (const comment of anime.comments) {
        if (!comment.avatar) continue;
        try {
          if (comment.avatar.startsWith('http')) {
            const res = await axios.get(comment.avatar, { responseType: 'arraybuffer', timeout: 30000 });
            const ext = res.headers['content-type'].includes('png') ? '.png' : '.jpg';
            const name = `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
            await fs.writeFile(path.join(avatarDir, name), res.data);
            comment.avatar = `avatar/${name}`;
          } else if (await fs.pathExists(comment.avatar)) {
            const name = path.basename(comment.avatar);
            const dest = path.join(avatarDir, name);
            if (!await fs.pathExists(dest)) await fs.copy(comment.avatar, dest);
            comment.avatar = `avatar/${name}`;
          }
        } catch (err) {
          logCallback(`  头像处理失败: ${err.message}`);
          comment.avatar = '';
        }
      }
    }
  }
}