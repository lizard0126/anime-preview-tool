import mammoth from 'mammoth';
import { load } from 'cheerio';
import fs from 'fs-extra';
import path from 'path';

const EXCLUDE_NAMES = new Set([
  '导演：', '原案：', '原作：', '动画制作：', '企划：'
]);

export async function parseDocx(docxPath, assetsPath, ttfDir, logCallback) {
  if (typeof docxPath === 'object' && docxPath.path) {
    docxPath = docxPath.path;
  }
  docxPath = path.resolve(docxPath);
  logCallback(`正在解析文档: ${docxPath}`);

  const saveBase64Image = (src) => {
    const match = src.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return null;
    const ext = match[1];
    const base64Data = match[2];
    const filename = `image${imgCounter++}.${ext}`;
    const filepath = path.join(visualDir, filename);
    fs.writeFileSync(filepath, Buffer.from(base64Data, 'base64'));
    return `visual/${filename}`;
  };

  const visualDir = path.join(assetsPath, 'visual');
  await fs.ensureDir(visualDir);

  const buffer = await fs.readFile(docxPath);
  const { value: html } = await mammoth.convertToHtml({
    buffer: buffer
  });
  const $ = load(html);
  const paragraphs = $('p').toArray();

  const animeData = [];
  const collectedImages = [];
  let imgCounter = 0;

  paragraphs.forEach((_, i) => {
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
        visual = saveBase64Image(collectedImages[i].src);
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

      const hasColon = t.includes('：');
      const hasImg = $p.find('img').length > 0;

      if (hasColon) {
        const [name, ...rest] = t.split(/：/);
        const trimmedName = name.trim();
        const commentText = rest.join('：').trim();

        if (trimmedName && !EXCLUDE_NAMES.has(trimmedName)) {
          currentName = trimmedName;
          comments.push({
            name: trimmedName,
            avatar: `avatar/${trimmedName}.jpg`,
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
                const imgPath = saveBase64Image(src);
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
      logCallback(`[跳过] 找不到标题，段落索引 ${pIdx}`);
    }
  }

  const files = fs.readdirSync(ttfDir);
  files.forEach((file) => {
    const ttfPath = path.join(ttfDir, file);
    const destPath = path.join(assetsPath, file);
    fs.copyFileSync(ttfPath, destPath);
  })

  const jsonPath = path.join(assetsPath, 'data.json');
  await fs.writeJson(jsonPath, animeData, { spaces: 2 });
  logCallback(`解析完成，共提取 ${animeData.length} 部动画，JSON 保存至 ${jsonPath}`);

  return animeData;
}