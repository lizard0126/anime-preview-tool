import axios from 'axios';
import { load } from 'cheerio';

export async function fetchAnimeList(season = '202607') {
  const url = `http://yuc.wiki/${season}/`;
  const response = await axios.get(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'http://yuc.wiki/'
    },
    timeout: 30000
  });

  const entries = response.data.match(/<!--#[A-C]\d+-->[\s\S]*?(?=<!--#[A-C]\d+-->|$)/g) || [];
  return entries.map(e => parseEntry(load(e))).filter(Boolean);
}

function parseEntry($) {
  const title = $('[class^="title_cn_r"]').first().text().trim();
  const subtitle = $('[class^="title_jp_r"]').first().text().trim() || '';
  const type = $('[class^="type_"]').first().text().trim() || '';

  const tags = [];
  $('[class^="type_tag"]').each((_, el) => {
    const t = $(el).text().trim();
    if (t) {
      t.split('\n').forEach(line => {
        const trimmed = line.trim();
        if (trimmed) tags.push(trimmed);
      });
    }
  });

  let visual = '';
  $('img[data-src]').first().each((_, el) => {
    visual = $(el).attr('data-src') || '';
  });

let staff = '';
$('[class^="staff_r"]').first().each((_, el) => {
  staff = $(el).html() || '';
  staff = staff.replace(/\s*<br\s*\/?>\s*/gi, '\n').replace(/&nbsp;/g, ' ').trim();
  staff = staff.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
});

let cast = '';
$('[class^="cast_r"]').first().each((_, el) => {
  cast = $(el).html() || '';
  cast = cast.replace(/\s*<br\s*\/?>\s*/gi, '\n').replace(/&nbsp;/g, ' ').trim();
  cast = cast.split('\n').map(line => line.trim()).filter(Boolean).join('\n');
});

  const broadcast = $('.broadcast_r').first().text().trim() || '';

  return {
    title,
    subtitle,
    type,
    tags,
    visual,
    staff,
    cast,
    broadcast,
    comments: [],
    selected: true
  };
}