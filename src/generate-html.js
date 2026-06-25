import fs from 'fs-extra';
import path from 'path';
import ejs from 'ejs';

export async function generateHtml(data, ejsDir, htmlDir, logCallback) {
  try {
    if (!await fs.pathExists(ejsDir)) {
      throw new Error(`模板文件不存在: ${ejsDir}`);
    }

    const template = await fs.readFile(ejsDir, 'utf-8');

    if (!data || data.length === 0) {
      logCallback('没有数据需要生成 HTML');
      return;
    }

    let index = 1;
    for (const item of data) {
      // 确保所有需要的数据都存在
      const templateData = {
        title: item.title || '未命名番剧',
        subtitle: item.subtitle || '',
        type: item.type || '',
        tags: item.tags || [],
        visual: item.visual || '',
        staff: item.staff || '',
        cast: item.cast || '',
        broadcast: item.broadcast || '',
        comments: Array.isArray(item.comments) ? item.comments : [],
        selected: item.selected !== false
      };

      // 确保每个评论都有必要的数据
      templateData.comments = templateData.comments.map(c => ({
        name: c.name || '匿名用户',
        avatar: c.avatar || '',
        text: c.text || '',
        medal: c.medal || ''
      }));

      if (!templateData.selected) {
        logCallback(`跳过未选择的番剧: ${templateData.title}`);
        continue;
      }

      let html;
      try {
        html = ejs.render(template, templateData);
      } catch (ejsErr) {
        logCallback(`  模板渲染错误 (${templateData.title}): ${ejsErr.message}`);
        // 使用备用模板
        html = generateFallbackHtml(templateData);
      }

      // 确保标题不会导致文件路径问题
      const safeTitle = String(templateData.title)
        .replace(/[\\/:*?"<>|]/g, '_')
        .substring(0, 100); // 限制文件名长度
      
      const outPath = path.join(htmlDir, `${index}_${safeTitle || 'unnamed'}.html`);
      
      try {
        await fs.writeFile(outPath, html, 'utf-8');
        logCallback(`已生成 HTML：${path.basename(outPath)}`);
      } catch (writeErr) {
        logCallback(`  写入文件失败: ${writeErr.message}`);
      }
      
      index++;
    }

    logCallback(`HTML 生成完成，共处理 ${index - 1} 个文件`);
  } catch (err) {
    logCallback(`HTML 生成失败: ${err.message}`);
    throw err;
  }
}

// 备用 HTML 模板
function generateFallbackHtml(data) {
  const commentsHtml = (data.comments || []).map(c => `
    <div style="display: flex; align-items: flex-start; gap: 24px; margin-bottom: 48px; width: 100%; box-sizing: border-box;">
      <img style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover; flex-shrink: 0; box-shadow: 0 4px 12px rgba(0, 0, 0, 1);"
           src="${c.avatar || ''}" alt="头像" />
      <div style="background: #fff; border-radius: 20px; padding: 20px; box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4);">
        <div style="font-weight: bold; font-size: 28px; margin-bottom: 8px;">${c.name || '匿名用户'}</div>
        <div style="font-size: 26px; color: #333;">${c.text || ''}</div>
      </div>
    </div>
  `).join('');

  return `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${data.title} - 备用页面</title>
  <style>
    body {
      margin: 0;
      padding: 40px;
      width: 800px;
      font-family: sans-serif;
      background: #fffef5;
      box-sizing: border-box;
    }
    h1 {
      font-size: 50px;
      color: #111;
      margin-bottom: 20px;
    }
    h2 {
      font-size: 36px;
      color: #666;
      margin-bottom: 40px;
    }
    .footer-credit {
      text-align: center;
      margin-top: 40px;
      font-size: 30px;
      color: #999;
    }
  </style>
</head>
<body>
  <h1>${data.title}</h1>
  ${data.subtitle ? `<h2>${data.subtitle}</h2>` : ''}
  ${commentsHtml}
  <div class="footer-credit">天央动漫社·节操部制作</div>
</body>
</html>`;
}