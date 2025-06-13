import fs from 'fs';
import ejs from 'ejs';

const data = JSON.parse(fs.readFileSync('./data.json', 'utf-8'));
const templatePath = './templates/page.ejs';

if (!fs.existsSync('./output')) fs.mkdirSync('./output');

let index = 1;
for (const item of data) {
  const html = await ejs.renderFile(templatePath, item, { async: true });
  const safeTitle = item.title.replace(/[\\/:*?"<>|]/g, '_');
  const filename = `${index}_${safeTitle}.html`;
  fs.writeFileSync(`./output/${filename}`, html, 'utf-8');
  console.log(`已生成：output/${filename}`);
  index++;
}