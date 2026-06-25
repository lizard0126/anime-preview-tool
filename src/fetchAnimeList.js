import axios from 'axios';
import { load } from 'cheerio';

// 从 yuc.wiki 抓取动画列表
export async function fetchAnimeList(season = '202607') {
  const url = `http://yuc.wiki/${season}/`;

  const response = await axios.get(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Referer: 'http://yuc.wiki/'
    },
    timeout: 30000
  });

  const html = response.data;
  const $ = load(html);
  const animeList = [];

  // 匹配所有动画条目（以 <!--#A01-->, <!--#B01-->, <!--#C01--> 等为标记）
  const entries = html.match(/<!--#[A-C]\d+-->[\s\S]*?(?=<!--#[A-C]\d+-->|$)/g) || [];

  for (const entryHtml of entries) {
    const $entry = load(entryHtml);
    const anime = parseAnimeEntry($entry);
    if (anime) {
      animeList.push(anime);
    }
  }

  return animeList;
}

//解析单个动画条目
function parseAnimeEntry($) {
  // 获取中文标题
  const titleCn = $('[class^="title_cn"]')
    .first()
    .text()
    .trim();

  // 获取日文标题
  const titleJp = $('[class^="title_jp"]')
    .first()
    .text()
    .trim();

  // 获取类型
  const type = $('.type_a_r, .type_b_r, .type_c_r')
    .first()
    .text()
    .trim();

  // 获取标签
  const tags = [];
  $('[class^="type_tag"]').each((_, el) => {
    const tag = $(el).text().trim();
    if (tag) tags.push(tag);
  });

  // 获取视觉图
  let visual = '';
  $('img[data-src]').first().each((_, el) => {
    visual = $(el).attr('data-src') || '';
  });

  // 获取制作人员
  const staff = $('[class^="staff_r"]')
    .first()
    .text()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/　/g, '');

  // 获取声优
  const cast = $('[class^="cast_r"]')
    .first()
    .text()
    .trim()
    .replace(/\s+/g, ' ');

  // 获取放送信息
  const broadcast = $('.broadcast_r')
    .first()
    .text()
    .trim();

  return {
    title: titleCn,
    subtitle: titleJp,
    type: type,
    tags: tags,
    visual: visual,
    staff: staff || '',
    cast: cast || '',
    broadcast: broadcast || '',
    comments: [],
    selected: true
  };
}