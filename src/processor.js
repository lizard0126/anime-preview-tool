import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

import { generateHtml } from './generate-html.js';
import { takeScreenshots } from './screenshot-html.js';
import { deleteTempFile } from './del-temp.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function processAnimePreview(config, logCallback) {
  const { data, outputDir } = config;

  await fs.ensureDir(outputDir);
  const assetsDir = path.join(outputDir, 'assets');
  await fs.ensureDir(assetsDir);

  // 准备素材
  logCallback('步骤1: 准备素材...');
  await prepareAssets(data, assetsDir, logCallback);

  // 只处理选中的动画
  const selectedData = data.filter(anime => anime.selected !== false);
  logCallback(`步骤2: 处理 ${selectedData.length}/${data.length} 部选中的动画`);

  // 生成 HTML
  logCallback('步骤3: 生成 HTML...');
  const ejsDir = path.join(__dirname, 'page.ejs');
  await generateHtml(selectedData, ejsDir, assetsDir, logCallback);

  // 截图
  logCallback('步骤4: 截图...');
  await takeScreenshots(assetsDir, outputDir, logCallback);

  // 清理临时文件
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

  // 复制字体文件到 assets/fonts 目录 - 从 src/fonts 目录复制
  const srcFontDir = path.join(__dirname, 'fonts');
  logCallback(`  字体源目录: ${srcFontDir}`);
  
  if (await fs.pathExists(srcFontDir)) {
    try {
      const fontFiles = await fs.readdir(srcFontDir);
      logCallback(`  发现 ${fontFiles.length} 个字体文件`);
      
      if (fontFiles.length === 0) {
        logCallback('  警告: fonts 目录为空，请确保有字体文件');
      }
      
      for (const fontFile of fontFiles) {
        const srcPath = path.join(srcFontDir, fontFile);
        const destPath = path.join(fontDir, fontFile);
        
        if (await fs.pathExists(srcPath)) {
          const ext = path.extname(fontFile).toLowerCase();
          if (['.ttf', '.otf', '.woff', '.woff2', '.eot'].includes(ext)) {
            await fs.copy(srcPath, destPath);
            logCallback(`  复制字体: ${fontFile}`);
          } else {
            logCallback(`  跳过非字体文件: ${fontFile}`);
          }
        }
      }
    } catch (err) {
      logCallback(`  警告: 字体复制失败: ${err.message}`);
    }
  } else {
    logCallback('  错误: src/fonts 目录不存在');
    await fs.ensureDir(fontDir);
  }

  for (const anime of data) {
    // 复制视觉图
    if (anime.visual) {
      try {
        if (anime.visual.startsWith('http')) {
          logCallback(`  下载视觉图: ${anime.visual.substring(0, 50)}...`);
          const response = await axios.get(anime.visual, { 
            responseType: 'arraybuffer',
            timeout: 30000 
          });
          const contentType = response.headers['content-type'] || '';
          let ext = '.jpg';
          if (contentType.includes('png')) ext = '.png';
          else if (contentType.includes('webp')) ext = '.webp';
          
          const visualName = `visual_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
          await fs.writeFile(path.join(visualDir, visualName), response.data);
          anime.visual = `visual/${visualName}`;
          logCallback(`  视觉图已保存: ${visualName}`);
        } else if (await fs.pathExists(anime.visual)) {
          const visualName = path.basename(anime.visual);
          const destPath = path.join(visualDir, visualName);
          if (await fs.pathExists(destPath)) {
            const ext = path.extname(visualName);
            const baseName = path.basename(visualName, ext);
            const newName = `${baseName}_${Date.now()}${ext}`;
            await fs.copy(anime.visual, path.join(visualDir, newName));
            anime.visual = `visual/${newName}`;
          } else {
            await fs.copy(anime.visual, destPath);
            anime.visual = `visual/${visualName}`;
          }
          logCallback(`  复制视觉图: ${visualName}`);
        } else {
          logCallback(`  警告: 视觉图文件不存在: ${anime.visual}`);
          anime.visual = '';
        }
      } catch (err) {
        logCallback(`  警告: 视觉图处理失败: ${err.message}`);
        anime.visual = '';
      }
    }

    // 复制头像
    if (anime.comments && Array.isArray(anime.comments)) {
      for (const comment of anime.comments) {
        if (comment.avatar) {
          try {
            if (comment.avatar.startsWith('http')) {
              logCallback(`  下载头像: ${comment.avatar.substring(0, 50)}...`);
              const response = await axios.get(comment.avatar, { 
                responseType: 'arraybuffer',
                timeout: 30000
              });
              const contentType = response.headers['content-type'] || '';
              let ext = '.jpg';
              if (contentType.includes('png')) ext = '.png';
              else if (contentType.includes('webp')) ext = '.webp';
              
              const avatarName = `avatar_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
              await fs.writeFile(path.join(avatarDir, avatarName), response.data);
              comment.avatar = `avatar/${avatarName}`;
              logCallback(`  头像已下载: ${avatarName}`);
            } else if (await fs.pathExists(comment.avatar)) {
              const avatarName = path.basename(comment.avatar);
              const destPath = path.join(avatarDir, avatarName);
              if (await fs.pathExists(destPath)) {
                const ext = path.extname(avatarName);
                const baseName = path.basename(avatarName, ext);
                const newName = `${baseName}_${Date.now()}${ext}`;
                await fs.copy(comment.avatar, path.join(avatarDir, newName));
                comment.avatar = `avatar/${newName}`;
              } else {
                await fs.copy(comment.avatar, destPath);
                comment.avatar = `avatar/${avatarName}`;
              }
              logCallback(`  复制头像: ${avatarName}`);
            } else {
              logCallback(`  警告: 头像文件不存在: ${comment.avatar}`);
              comment.avatar = '';
            }
          } catch (err) {
            logCallback(`  警告: 头像处理失败: ${err.message}`);
            comment.avatar = '';
          }
        }
      }
    }
  }
}