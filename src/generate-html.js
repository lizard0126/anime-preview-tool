import fs from 'fs-extra';
import path from 'path';
import ejs from 'ejs';

export async function generateHtml(data, ejsDir, htmlDir, logCallback) {
  if (!data?.length) { logCallback('没有数据需要生成 HTML'); return; }

  const template = await fs.readFile(ejsDir, 'utf-8');
  let index = 1;

  for (const item of data) {
    const tplData = {
      title: item.title || '未命名番剧',
      subtitle: item.subtitle || '',
      visual: item.visual || '',
      comments: (item.comments || []).map(c => ({
        name: c.name || '匿名用户',
        avatar: c.avatar || '',
        text: c.text || '',
        medal: c.medal || ''
      })),
      selected: item.selected !== false
    };

    if (!tplData.selected) { logCallback(`跳过未选择的: ${tplData.title}`); continue; }

    const html = ejs.render(template, tplData);
    const safeName = tplData.title.replace(/[\\/:*?"<>|]/g, '_').substring(0, 100);
    await fs.writeFile(path.join(htmlDir, `${index}_${safeName || 'unnamed'}.html`), html, 'utf-8');
    logCallback(`已生成 HTML：${index}_${safeName}.html`);
    index++;
  }
  logCallback(`HTML 生成完成，共处理 ${index - 1} 个文件`);
}