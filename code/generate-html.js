import fs from 'fs';
import path from 'path';
import ejs from 'ejs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT_DIR = path.join(__dirname, '..');
const dataPath = path.join(__dirname, 'data.json');
const templatePath = path.join(__dirname, 'page.ejs');
const tempDir = path.join(ROOT_DIR, 'temp');

const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

let index = 1;
for (const item of data) {
  const html = await ejs.renderFile(templatePath, item, { async: true });
  const safeTitle = item.title.replace(/[\\/:*?"<>|]/g, '_');
  const outPath = path.join(tempDir, `${index}_${safeTitle}.html`);
  fs.writeFileSync(outPath, html, 'utf-8');
  console.log(`已生成：${outPath}`);
  index++;
}