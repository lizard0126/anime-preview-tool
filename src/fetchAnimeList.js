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
  const title = $('[class^="title_cn"]').first().text().trim();
  if (!title) return null;

  return {
    title,
    subtitle: $('[class^="title_jp"]').first().text().trim() || '',
    type: $('.type_a_r, .type_b_r, .type_c_r').first().text().trim() || '',
    tags: (() => {
      const tags = [];
      $('[class^="type_tag"]').each((_, el) => { const t = $(el).text().trim(); if (t) tags.push(t); });
      return tags;
    })(),
    visual: (() => {
      let v = '';
      $('img[data-src]').first().each((_, el) => { v = $(el).attr('data-src') || ''; });
      return v;
    })(),
    staff: $('[class^="staff_r"]').first().text().trim().replace(/\s+/g, '') || '',
    cast: $('[class^="cast_r"]').first().text().trim().replace(/\s+/g, ' ') || '',
    broadcast: $('.broadcast_r').first().text().trim() || '',
    comments: [],
    selected: true
  };
}