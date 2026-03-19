import fs from 'fs-extra';
import path from 'path';
import ejs from 'ejs';

export async function generateHtml(data, ejsDir, htmlDir, logCallback) {
  const template = await fs.readFile(ejsDir, 'utf-8');

  let index = 1;
  for (const item of data) {
    const html = ejs.render(template, item);
    const safeTitle = item.title.replace(/[\\/:*?"<>|]/g, '_');
    const outPath = path.join(htmlDir, `${index}_${safeTitle}.html`);
    await fs.writeFile(outPath, html, 'utf-8');
    logCallback(`已生成 HTML：${outPath}`);
    index++;
  }

  logCallback(`HTML 生成完成，共 ${data.length} 个文件`);
}