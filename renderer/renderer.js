let projectData = {
  title: '新番速递',
  animes: []
};

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  renderAnimeList();
});

function initEventListeners() {
  window.electronAPI.onLog((msg) => {
    const logDiv = document.getElementById('log');
    logDiv.innerHTML += `<div>${escapeHtml(msg)}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
  });

  window.electronAPI.onDone((result) => {
    const logDiv = document.getElementById('log');
    logDiv.innerHTML += `<div style="color:green;">✅ 处理完成${result?.outputDir ? `！输出目录: ${result.outputDir}` : '！'}</div>`;
    document.getElementById('exportBtn').disabled = false;
    document.getElementById('exportBtn').textContent = '导出图片';
  });

  document.getElementById('fetchBtn').addEventListener('click', async () => {
    const season = document.getElementById('seasonInput').value || '';
    const logDiv = document.getElementById('log');
    logDiv.innerHTML += `<div>正在抓取 ${season} 季度动画...</div>`;

    try {
      const result = await window.electronAPI.fetchAnimeList(season);
      if (result.success) {
        projectData.animes = result.data;
        renderAnimeList();
        logDiv.innerHTML += `<div style="color:green;">✅ 成功加载 ${result.data.length} 部动画</div>`;
      } else {
        logDiv.innerHTML += `<div style="color:red;">❌ 抓取失败: ${escapeHtml(result.error || '未知错误')}</div>`;
      }
    } catch (err) {
      logDiv.innerHTML += `<div style="color:red;">❌ 抓取异常: ${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById('addAnimeBtn').addEventListener('click', () => {
    projectData.animes.push({ title: '新番名称', subtitle: '', type: '', tags: [], visual: '', staff: '', cast: '', broadcast: '', comments: [], selected: true });
    renderAnimeList();
  });

  document.getElementById('loadJsonBtn').addEventListener('click', async () => {
    try {
      const files = await window.electronAPI.selectFile({ properties: ['openFile'], filters: [{ name: 'JSON 文件', extensions: ['json'] }] });
      if (files?.length) {
        const result = await window.electronAPI.loadJson(files[0]);
        if (result.success) {
          projectData = result.data;
          renderAnimeList();
          document.getElementById('log').innerHTML += `<div style="color:green;">✅ 导入 JSON 成功</div>`;
        } else {
          document.getElementById('log').innerHTML += `<div style="color:red;">❌ 导入失败: ${escapeHtml(result.error)}</div>`;
        }
      }
    } catch (err) {
      document.getElementById('log').innerHTML += `<div style="color:red;">❌ 导入异常: ${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById('saveJsonBtn').addEventListener('click', async () => {
    try {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) {
        const result = await window.electronAPI.saveJson(projectData, dir);
        if (result.success) {
          document.getElementById('log').innerHTML += `<div style="color:green;">✅ JSON 已保存到 ${escapeHtml(dir)}</div>`;
        } else {
          document.getElementById('log').innerHTML += `<div style="color:red;">❌ 保存失败: ${escapeHtml(result.error)}</div>`;
        }
      }
    } catch (err) {
      document.getElementById('log').innerHTML += `<div style="color:red;">❌ 保存异常: ${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById('exportBtn').addEventListener('click', async () => {
    try {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) {
        document.getElementById('exportBtn').disabled = true;
        document.getElementById('exportBtn').textContent = '处理中...';
        await window.electronAPI.startProcess({ data: projectData.animes, outputDir: dir });
      }
    } catch (err) {
      document.getElementById('log').innerHTML += `<div style="color:red;">❌ 处理异常: ${escapeHtml(err.message)}</div>`;
      document.getElementById('exportBtn').disabled = false;
      document.getElementById('exportBtn').textContent = '导出图片';
    }
  });

  window.addEventListener('beforeunload', () => {
    window.electronAPI.removeAllListeners?.('log');
  });
}

function renderAnimeList() {
  const container = document.getElementById('animeList');
  container.innerHTML = '';

  if (!projectData.animes?.length) {
    container.innerHTML = '<div class="empty-state">暂无番剧数据，请点击"从 yuc.wiki 抓取"或"添加番剧"</div>';
    return;
  }

  projectData.animes.forEach((anime, index) => {
    const card = document.createElement('div');
    card.className = 'anime-card';

    const comments = Array.isArray(anime.comments) ? anime.comments : [];
    const tags = Array.isArray(anime.tags) ? anime.tags : [];

    card.innerHTML = `
      <div class="anime-header">
        <input type="checkbox" class="anime-select" data-index="${index}" ${anime.selected !== false ? 'checked' : ''}>
        <span class="anime-index">#${index + 1}</span>
        <input type="text" class="title-input" value="${escapeHtml(anime.title || '')}" placeholder="中文标题" data-index="${index}">
        <input type="text" class="subtitle-input" value="${escapeHtml(anime.subtitle || '')}" placeholder="日文标题" data-index="${index}">
        <button class="preview-btn" data-index="${index}">预览</button>
        <button class="delete-btn" data-index="${index}">×</button>
      </div>
      <div class="anime-info">
        <span>类型: ${escapeHtml(anime.type || '')}</span>
        <div class="tags">${tags.map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}</div>
        <span>${escapeHtml(anime.broadcast || '')}</span>
      </div>
      <div class="visual-select">
        <span class="visual-path" title="${escapeHtml(anime.visual || '未选择视觉图')}">${anime.visual || '未选择视觉图'}</span>
        <button class="select-visual-btn" data-index="${index}">选择视觉图</button>
      </div>
      <div class="comments-section">
        <div class="comments-header">
          <span>评论 (${comments.length})</span>
          <button class="add-comment-btn" data-index="${index}">添加评论</button>
        </div>
        <div class="comments-list" data-index="${index}">
          ${comments.map((c, ci) => `
            <div class="comment-item">
              <div class="comment-row">
                <input type="text" class="comment-name" value="${escapeHtml(c.name || '')}" placeholder="昵称" data-anime="${index}" data-comment="${ci}">
                <select class="comment-medal" data-anime="${index}" data-comment="${ci}">
                  <option value="">无奖牌</option>
                  <option value="金牌" ${c.medal === '金牌' ? 'selected' : ''}>金牌</option>
                  <option value="银牌" ${c.medal === '银牌' ? 'selected' : ''}>银牌</option>
                  <option value="黑牌" ${c.medal === '黑牌' ? 'selected' : ''}>黑牌</option>
                </select>
                <span class="avatar-path">${c.avatar ? '已选择头像' : '未选择头像'}</span>
                <button class="select-avatar-btn" data-anime="${index}" data-comment="${ci}">头像</button>
                <button class="delete-comment-btn" data-anime="${index}" data-comment="${ci}">×</button>
              </div>
              <textarea class="comment-text" placeholder="评论内容" data-anime="${index}" data-comment="${ci}">${escapeHtml(c.text || '')}</textarea>
            </div>`
    ).join('')}
        </div>
      </div>`;
    container.appendChild(card);
  });

  bindAnimeEvents();
}

function bindAnimeEvents() {
  document.querySelectorAll('.anime-select').forEach(cb => {
    cb.addEventListener('change', e => {
      projectData.animes[parseInt(e.target.dataset.index)].selected = e.target.checked;
    });
  });

  document.querySelectorAll('.title-input').forEach(input => {
    input.addEventListener('change', e => {
      projectData.animes[parseInt(e.target.dataset.index)].title = e.target.value;
    });
  });

  document.querySelectorAll('.subtitle-input').forEach(input => {
    input.addEventListener('change', e => {
      projectData.animes[parseInt(e.target.dataset.index)].subtitle = e.target.value;
    });
  });

  document.querySelectorAll('.preview-btn').forEach(btn => {
    btn.addEventListener('click', e => previewAnime(parseInt(e.target.dataset.index)));
  });

  document.querySelectorAll('.delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      if (confirm('确定删除？')) {
        projectData.animes.splice(parseInt(e.target.dataset.index), 1);
        renderAnimeList();
      }
    });
  });

  document.querySelectorAll('.select-visual-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const files = await window.electronAPI.selectFile({ properties: ['openFile'], filters: [{ name: '图片文件', extensions: ['jpg', 'png', 'jpeg', 'webp'] }] });
      if (files?.length) {
        projectData.animes[parseInt(e.target.dataset.index)].visual = files[0];
        renderAnimeList();
      }
    });
  });

  document.querySelectorAll('.add-comment-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.target.dataset.index);
      projectData.animes[idx].comments = projectData.animes[idx].comments || [];
      projectData.animes[idx].comments.push({ name: '', avatar: '', text: '', medal: '' });
      renderAnimeList();
    });
  });

  document.querySelectorAll('.comment-name').forEach(input => {
    input.addEventListener('change', e => {
      const { anime, comment } = e.target.dataset;
      projectData.animes[anime].comments[comment].name = e.target.value;
    });
  });

  document.querySelectorAll('.comment-text').forEach(textarea => {
    textarea.addEventListener('change', e => {
      const { anime, comment } = e.target.dataset;
      projectData.animes[anime].comments[comment].text = e.target.value;
    });
  });

  document.querySelectorAll('.comment-medal').forEach(select => {
    select.addEventListener('change', e => {
      const { anime, comment } = e.target.dataset;
      projectData.animes[anime].comments[comment].medal = e.target.value;
    });
  });

  document.querySelectorAll('.select-avatar-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const files = await window.electronAPI.selectFile({ properties: ['openFile'], filters: [{ name: '图片文件', extensions: ['jpg', 'png', 'jpeg', 'webp'] }] });
      if (files?.length) {
        const { anime, comment } = e.target.dataset;
        projectData.animes[anime].comments[comment].avatar = files[0];
        renderAnimeList();
      }
    });
  });

  document.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const { anime, comment } = e.target.dataset;
      projectData.animes[anime].comments.splice(parseInt(comment), 1);
      renderAnimeList();
    });
  });
}

async function previewAnime(index) {
  const anime = projectData.animes[index];
  if (!anime) return;

  const container = document.getElementById('previewContainer');
  container.innerHTML = '<div class="preview-loading">正在生成预览...</div>';

  try {
    const result = await window.electronAPI.generatePreview(anime);
    if (!result.success || !result.html) {
      container.innerHTML = `<div class="preview-error">预览失败: ${escapeHtml(result.error || '未知错误')}</div>`;
      return;
    }

    // 读取字体 - 添加调试信息
    const fontResult = await window.electronAPI.readAllFonts();
    document.getElementById('log').innerHTML += `<div style="color:gray;">字体加载结果: ${JSON.stringify(fontResult.success ? Object.keys(fontResult.fonts) : '失败')}</div>`;

    let fontStyles = '';
    if (fontResult.success) {
      const fonts = fontResult.fonts;
      if (fonts['label.ttf']) {
        fontStyles += `@font-face{font-family:'label';src:url('data:font/ttf;base64,${fonts['label.ttf']}')format('truetype')}`;
        document.getElementById('log').innerHTML += `<div style="color:gray;">✅ 已加载 label.ttf</div>`;
      } else {
        document.getElementById('log').innerHTML += `<div style="color:orange;">⚠️ 未找到 label.ttf</div>`;
      }
      if (fonts['title.ttf']) {
        fontStyles += `@font-face{font-family:'title';src:url('data:font/ttf;base64,${fonts['title.ttf']}')format('truetype')}`;
        document.getElementById('log').innerHTML += `<div style="color:gray;">✅ 已加载 title.ttf</div>`;
      } else {
        document.getElementById('log').innerHTML += `<div style="color:orange;">⚠️ 未找到 title.ttf</div>`;
      }
      if (fonts['footer.ttf']) {
        fontStyles += `@font-face{font-family:'footer';src:url('data:font/ttf;base64,${fonts['footer.ttf']}')format('truetype')}`;
        document.getElementById('log').innerHTML += `<div style="color:gray;">✅ 已加载 footer.ttf</div>`;
      } else {
        document.getElementById('log').innerHTML += `<div style="color:orange;">⚠️ 未找到 footer.ttf</div>`;
      }
    } else {
      document.getElementById('log').innerHTML += `<div style="color:red;">❌ 字体加载失败: ${escapeHtml(fontResult.error)}</div>`;
    }

    let html = result.html;
    html = html.replace(/@font-face\s*\{[^}]*\}/g, '');

    // 嵌入视觉图
    if (anime.visual && !anime.visual.startsWith('http') && !anime.visual.startsWith('data:')) {
      const imgData = await window.electronAPI.readFile(anime.visual);
      if (imgData.success) {
        const dataUrl = `data:${imgData.mimeType};base64,${imgData.data}`;
        html = html.replace(/(<img[^>]*class="[^"]*\bvisual-image\b[^"]*"[^>]*src=")[^"]*("[^>]*>)/, `$1${dataUrl}$2`);
      }
    }

    // 嵌入头像
    if (anime.comments) {
      for (const comment of anime.comments) {
        if (comment.avatar && !comment.avatar.startsWith('http') && !comment.avatar.startsWith('data:')) {
          const avatarData = await window.electronAPI.readFile(comment.avatar);
          if (avatarData.success) {
            const dataUrl = `data:${avatarData.mimeType};base64,${avatarData.data}`;
            const name = comment.avatar.split(/[/\\]/).pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`(<img[^>]*class="[^"]*\\bavatar\\b[^"]*"[^>]*src=")[^"]*${name}[^"]*("[^>]*>)`);
            html = html.replace(re, `$1${dataUrl}$2`);
          }
        }
      }
    }

    // 移除外部脚本引用
    html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');

    // 提取样式和内容
    const styles = extractStyles(html);
    const body = extractBody(html);

    // 创建 iframe 隔离样式
    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:100%;border:none;overflow:auto;background:#fffef5;border-radius:8px;';

    container.innerHTML = '';
    container.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="zh">
<head><meta charset="UTF-8">
<style>${fontStyles}
body{margin:0;padding:40px;width:800px;font-family:sans-serif;background:#fffef5;box-sizing:border-box;}
${styles}</style></head>
<body>${body}
<script>window.addEventListener('load',function(){setTimeout(function(){
var cw=document.querySelector('.comment-wrapper'),jt=document.querySelector('.jp-title');
if(cw&&jt){var mh=cw.getBoundingClientRect().bottom-jt.getBoundingClientRect().top;jt.style.maxHeight=mh+'px';}},500)});<\/script>
</body></html>`);
    doc.close();

    document.getElementById('log').innerHTML += `<div style="color:green;">✅ 预览生成成功</div>`;
  } catch (err) {
    container.innerHTML = `<div class="preview-error">预览异常: ${escapeHtml(err.message)}</div>`;
    document.getElementById('log').innerHTML += `<div style="color:red;">❌ 预览异常: ${escapeHtml(err.message)}</div>`;
  }
}

function extractStyles(html) {
  const re = /<style>([\s\S]*?)<\/style>/g;
  let styles = '', m;
  while ((m = re.exec(html))) styles += m[1] + '\n';
  return styles;
}

function extractBody(html) {
  const m = /<body>([\s\S]*?)<\/body>/i.exec(html);
  return m ? m[1] : html.replace(/<!DOCTYPE[^>]*>/i, '').replace(/<html[^>]*>/i, '').replace(/<\/html>/i, '').replace(/<head>[\s\S]*?<\/head>/i, '');
}

function escapeHtml(text) {
  if (!text) return '';
  const d = document.createElement('div');
  d.textContent = text;
  return d.innerHTML;
}