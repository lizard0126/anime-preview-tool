const mammoth = require('mammoth');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const ASSETS_DIR = path.join(OUTPUT_DIR, 'assets', 'visual');
const JSON_PATH = path.join(__dirname, 'data.json');

const EXCLUDE_NAMES = new Set([
  '导演',
  '#1导演',
  '编剧',
  '原案',
  '音乐',
  '动画制作',
  '人设',
  '总作监',
  '动导',
  '原作',
]);

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function saveBase64Image(src, index) {
  const match = src.match(/^data:image\/(\w+);base64,(.+)$/);
  if (!match) return null;

  const ext = match[1];
  const base64Data = match[2];
  const filename = `image${index}.${ext}`;
  const filepath = path.join(ASSETS_DIR, filename);
  fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
  return `assets/visual/${filename}`;
}

async function parseDocxToJson(docxPath) {
  try {
    ensureDir(ASSETS_DIR);
    console.log(`正在读取文档: ${docxPath}`);

    const { value: html } = await mammoth.convertToHtml({ path: docxPath });
    const $ = cheerio.load(html);

    const paragraphs = $('p').toArray();
    const images = $('img').toArray();

    const animeData = [];
    let imgIdx = 0;
    let pIdx = 0;

    while (imgIdx < images.length && pIdx < paragraphs.length) {
      const imgSrc = $(images[imgIdx]).attr('src');
      const visual = imgSrc?.startsWith('data:image') ? saveBase64Image(imgSrc, imgIdx) : '';
      imgIdx++;

      while (pIdx < paragraphs.length && $(paragraphs[pIdx]).find('img').length === 0) {
        pIdx++;
      }
      pIdx++;

      const titleCn = $(paragraphs[pIdx])?.text().trim() || '';
      const titleJp = $(paragraphs[pIdx + 1])?.text().trim() || '';
      pIdx += 2;

      const comments = [];
      while (pIdx < paragraphs.length) {
        const text = $(paragraphs[pIdx]).text().trim();

        if ($(paragraphs[pIdx]).find('img').length > 0) break;

        if (text.includes('：')) {
          const [name, ...rest] = text.split('：');
          const trimmedName = name.trim();
          const commentText = rest.join('：').trim();
          if (!EXCLUDE_NAMES.has(trimmedName) && trimmedName && commentText) {
            comments.push({
              name: name.trim(),
              avatar: `assets/avatar/${name.trim()}.jpg`,
              text: commentText
            });
          }
        }

        pIdx++;
      }

      if (titleCn && titleJp && visual) {
        animeData.push({
          title: titleCn,
          subtitle: titleJp,
          visual,
          comments
        });
        console.log(`提取: ${titleCn} / ${titleJp}，评论数：${comments.length}`);
      }
    }

    fs.writeFileSync(JSON_PATH, JSON.stringify(animeData, null, 2), 'utf-8');
    console.log(`完成：共提取 ${animeData.length} 部动画`);
    console.log(`JSON 输出文件：${JSON_PATH}`);
  } catch (err) {
    console.error('解析失败:', err);
  }
}

const docxFiles = fs.readdirSync(__dirname).filter(file => file.toLowerCase().endsWith('.docx'));

if (docxFiles.length === 0) {
  console.error('未找到任何 .docx 文件，请将文件放入当前目录。');
  process.exit(1);
}

const targetDocx = docxFiles
  .map(f => ({ name: f, mtime: fs.statSync(path.join(__dirname, f)).mtime }))
  .sort((a, b) => b.mtime - a.mtime)[0].name;
console.log(`检测到文档：${targetDocx}`);

parseDocxToJson(path.join(__dirname, targetDocx));