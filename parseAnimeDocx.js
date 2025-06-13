const mammoth = require('mammoth');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');
const ASSETS_DIR = path.join(OUTPUT_DIR, 'assets', 'visual');
const JSON_PATH = path.join(__dirname, 'data.json');

const EXCLUDE_NAMES = new Set([
  '导演：', '原案：', '原作：', '动画制作：',
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

    const animeData = [];
    const collectedImages = [];
    let imgCounter = 0;

    paragraphs.forEach(($p, i) => {
      const img = $(paragraphs[i]).find('img');
      if (img.length > 0) {
        const src = img.attr('src');
        if (src?.startsWith('data:image')) {
          collectedImages.push({ pIdx: i, src });
        }
      }
    });

    let pIdx = 0;
    while (pIdx < paragraphs.length) {
      const $cur = $(paragraphs[pIdx]);
      const text = $cur.text().trim();
      const isCredit = [...EXCLUDE_NAMES].some(name => text.includes(name));

      if (!isCredit) {
        pIdx++;
        continue;
      }

      let visual = '';
      let visualIdx = -1;
      for (let i = collectedImages.length - 1; i >= 0; i--) {
        if (collectedImages[i].pIdx < pIdx) {
          visual = saveBase64Image(collectedImages[i].src, imgCounter++);
          visualIdx = collectedImages[i].pIdx;
          collectedImages.splice(i, 1);
          break;
        }
      }

      if (visualIdx === -1) {
        pIdx++;
        continue;
      }

      let titleCn = '', titleJp = '';
      let titleEnd = visualIdx;

      if (visualIdx + 1 < paragraphs.length) {
        titleCn = $(paragraphs[visualIdx + 1]).text().trim();
        titleEnd = visualIdx + 1;
      }
      if (visualIdx + 2 < paragraphs.length) {
        titleJp = $(paragraphs[visualIdx + 2]).text().trim();
        titleEnd = visualIdx + 2;
      }

      pIdx = titleEnd + 1;
      const comments = [];
      let currentName = '';

      let creditCount = 0;
      while (pIdx < paragraphs.length) {
        const $p = $(paragraphs[pIdx]);
        const t = $p.text().trim();
        const isNewCredit = [...EXCLUDE_NAMES].some(name => t.includes(name));

        if (isNewCredit) {
          creditCount++;
          if (creditCount >= 2) {
            if (comments.length > 0) {
              const lastComment = comments[comments.length - 1];
              const lastImgIndex = lastComment.text.lastIndexOf('<img src=');
              if (lastImgIndex !== -1) {
                lastComment.text = lastComment.text.substring(0, lastImgIndex).trim();
              }
            }
            break;
          } else {
            pIdx++;
            continue;
          }
        }

        const hasColon = t.includes('：') ;
        const hasImg = $p.find('img').length > 0;

        if (hasColon) {
          const [name, ...rest] = t.split(/：/);
          const trimmedName = name.trim();
          const commentText = rest.join('：').trim();

          if (trimmedName && !EXCLUDE_NAMES.has(trimmedName)) {
            currentName = trimmedName;
            comments.push({
              name: trimmedName,
              avatar: `assets/avatar/${trimmedName}.jpg`,
              text: commentText,
            });
          }
        } else {
          if (currentName && comments.length > 0) {
            if (t) {
              comments[comments.length - 1].text += '<br>' + t;
            }
            if (hasImg) {
              $p.find('img').each((_, img) => {
                const src = $(img).attr('src');
                if (src?.startsWith('data:image')) {
                  const imgPath = saveBase64Image(src, imgCounter++);
                  comments[comments.length - 1].text += ` <img src="${imgPath}">`;
                }
              });
            }
          }
        }

        pIdx++;
      }

      if (titleCn) {
        animeData.push({
          title: titleCn,
          subtitle: titleJp || '',
          visual,
          comments,
        });
      } else {
        console.log(`[跳过] 找不到标题，段落 ${pIdx}`);
      }
    }

    fs.writeFileSync(JSON_PATH, JSON.stringify(animeData, null, 2), 'utf-8');
    console.log(`\n[完成] 共提取 ${animeData.length} 部动画`);
    console.log(`[输出文件] ${JSON_PATH}`);
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