let projectData = {
  title: '新番速递',
  animes: []
};

let defaultCommenter = {
  name: '',
  avatar: ''
};

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  renderAnimeList();
  renderDefaultCommenterUI();
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
        // 保存现有评论（按标题映射）
        const existingComments = new Map();
        projectData.animes.forEach(anime => {
          if (anime.title && anime.comments?.length) {
            existingComments.set(anime.title, anime.comments);
          }
        });

        // 将评论合并到新数据中
        const newAnimes = result.data.map(anime => {
          const comments = existingComments.get(anime.title);
          if (comments) {
            return { ...anime, comments };
          }
          return anime;
        });

        projectData.animes = newAnimes;
        renderAnimeList();
        logDiv.innerHTML +=
          `<div style="color:green;">✅ 成功加载 ${result.data.length} 部动画` +
          `（已保留 ${existingComments.size} 部动画的评论）</div>`;
      } else {
        logDiv.innerHTML += `<div style="color:red;">❌ 抓取失败: ${escapeHtml(result.error || '未知错误')}</div>`;
      }
    } catch (err) {
      logDiv.innerHTML += `<div style="color:red;">❌ 抓取异常: ${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById('addAnimeBtn').addEventListener('click', () => {
    projectData.animes.push({ title: '新番名称', subtitle: '日文原名', type: '', tags: [], visual: '', staff: '', cast: '', broadcast: '', comments: [], selected: true });
    renderAnimeList();
  });

  document.getElementById('loadJsonBtn').addEventListener('click', async () => {
    try {
      const files = await window.electronAPI.selectFile({
        properties: ['openFile'],
        filters: [{ name: 'JSON 文件', extensions: ['json'] }]
      });
      if (!files?.length) return;

      const result = await window.electronAPI.loadJson(files[0]);
      if (!result.success) {
        document.getElementById('log').innerHTML += `<div style="color:red;">❌ 导入失败: ${escapeHtml(result.error)}</div>`;
        return;
      }

      const importedData = result.data;
      const importedAnimes = importedData.animes || [];

      if (!importedAnimes.length) {
        document.getElementById('log').innerHTML += `<div style="color:orange;">⚠️ JSON 中没有动画数据</div>`;
        return;
      }

      // 确认导入模式
      const mode = confirm(
        `JSON 中包含 ${importedAnimes.length} 部动画。\n\n` +
        `点击"确定" - 合并评论（按标题匹配，保留本地数据）\n` +
        `点击"取消" - 替换全部数据`
      );

      if (mode) {
        // 合并评论模式
        // 构建标题 → 动画的映射（本地数据）
        const localMap = new Map();
        projectData.animes.forEach(anime => {
          if (anime.title) localMap.set(anime.title, anime);
        });

        let matchedCount = 0;
        let unmatchedCount = 0;
        let totalCommentsAdded = 0;

        for (const importedAnime of importedAnimes) {
          if (!importedAnime.title) continue;

          const localAnime = localMap.get(importedAnime.title);

          if (localAnime) {
            // 找到了匹配的本地动画，合并评论
            if (!localAnime.comments) localAnime.comments = [];

            const importedComments = importedAnime.comments || [];
            for (const comment of importedComments) {
              // 根据评论昵称去重，避免重复导入同一个人的评论
              const existingNames = new Set(localAnime.comments.map(c => c.name));
              if (comment.name && !existingNames.has(comment.name)) {
                localAnime.comments.push({
                  name: comment.name || '',
                  avatar: comment.avatar || '',
                  text: comment.text || '',
                  medal: comment.medal || '',
                  images: comment.images || []
                });
                totalCommentsAdded++;
              }
            }
            matchedCount++;
          } else {
            // 没有匹配的本地动画
            unmatchedCount++;
          }
        }

        document.getElementById('log').innerHTML +=
          `<div style="color:green;">✅ 评论合并完成：匹配 ${matchedCount} 部动画，` +
          `新增 ${totalCommentsAdded} 条评论` +
          `${unmatchedCount > 0 ? `，${unmatchedCount} 部未匹配（标题不一致）` : ''}</div>`;
      } else {
        // 替换模式 - 完全替换数据
        projectData = importedData;
        document.getElementById('log').innerHTML +=
          `<div style="color:green;">✅ 已替换为 JSON 数据，共 ${importedAnimes.length} 部动画</div>`;
      }

      renderAnimeList();
    } catch (err) {
      document.getElementById('log').innerHTML += `<div style="color:red;">❌ 导入异常: ${escapeHtml(err.message)}</div>`;
    }
  });

  document.getElementById('saveJsonBtn').addEventListener('click', async () => {
    try {
      // 弹出保存文件对话框，让用户指定文件名
      const filePath = await window.electronAPI.saveFileDialog({
        title: '导出评论数据',
        defaultPath: `评论数据_${new Date().toISOString().slice(0, 10)}.json`,
        filters: [{ name: 'JSON 文件', extensions: ['json'] }]
      });

      if (!filePath) return;

      // 只导出需要的数据（标题 + 评论），减小文件体积
      const exportData = {
        title: projectData.title || '新番速递',
        animes: projectData.animes.map(anime => ({
          title: anime.title,
          subtitle: anime.subtitle,
          comments: (anime.comments || []).map(c => ({
            name: c.name,
            avatar: c.avatar,
            text: c.text,
            medal: c.medal,
            images: c.images || []
          }))
        }))
      };

      const result = await window.electronAPI.saveJson(exportData, filePath);
      if (result.success) {
        const fileName = filePath.split(/[/\\]/).pop();
        document.getElementById('log').innerHTML +=
          `<div style="color:green;">✅ 评论数据已导出：${escapeHtml(fileName)}</div>`;
      } else {
        document.getElementById('log').innerHTML += `<div style="color:red;">❌ 导出失败: ${escapeHtml(result.error)}</div>`;
      }
    } catch (err) {
      document.getElementById('log').innerHTML += `<div style="color:red;">❌ 导出异常: ${escapeHtml(err.message)}</div>`;
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

  // 清除全部动画
  document.getElementById('clearAllBtn').addEventListener('click', () => {
    if (!projectData.animes?.length) {
      document.getElementById('log').innerHTML += `<div style="color:orange;">⚠️ 没有动画可清除</div>`;
      return;
    }

    if (confirm(`确定要清除全部 ${projectData.animes.length} 部动画吗？此操作不可撤销！`)) {
      projectData.animes = [];
      renderAnimeList();
      document.getElementById('log').innerHTML += `<div style="color:green;">✅ 已清除全部动画</div>`;
    }
  });

  // 全选/取消全选
  document.getElementById('toggleSelectAllBtn').addEventListener('click', () => {
    const animes = projectData.animes;
    if (!animes?.length) {
      document.getElementById('log').innerHTML += `<div style="color:orange;">⚠️ 没有动画可选择</div>`;
      return;
    }

    // 检查当前是否全部选中
    const allSelected = animes.every(a => a.selected !== false);

    // 如果全部选中则取消全选，否则全选
    const newState = !allSelected;
    animes.forEach(anime => {
      anime.selected = newState;
    });

    // 更新按钮文字
    document.getElementById('toggleSelectAllBtn').textContent = newState ? '取消全选' : '全选';

    // 重新渲染列表
    renderAnimeList();

    document.getElementById('log').innerHTML += `<div style="color:green;">✅ 已${newState ? '全选' : '取消全选'}所有动画</div>`;
  });

  window.addEventListener('beforeunload', () => {
    window.electronAPI.removeAllListeners?.('log');
  });

  // 日志区高度调整
  const logContainer = document.getElementById('logContainer');
  const resizeHandle = document.getElementById('logResizeHandle');

  if (resizeHandle) {
    resizeHandle.addEventListener('mousedown', (e) => {
      e.preventDefault();

      const startY = e.clientY;
      const startHeight = logContainer.offsetHeight;

      const onMouseMove = (moveEvent) => {
        const deltaY = startY - moveEvent.clientY;
        const newHeight = Math.max(40, Math.min(400, startHeight + deltaY));
        logContainer.style.height = `${newHeight}px`;

        // 同时调整 .app 的高度
        const app = document.querySelector('.app');
        if (app) {
          app.style.height = `calc(100vh - ${newHeight}px)`;
        }
      };

      const onMouseUp = () => {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMouseMove);
      document.addEventListener('mouseup', onMouseUp);

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';
    });
  }
}

// 渲染默认评论者 UI
function renderDefaultCommenterUI() {
  const container = document.getElementById('defaultCommenterContainer');
  if (!container) return;

  container.innerHTML = `
    <div class="default-commenter">
      <span class="dc-label">默认信息:</span>
      <input type="text" class="dc-name" value="${escapeHtml(defaultCommenter.name)}" placeholder="昵称">
      <span class="dc-avatar-path">${defaultCommenter.avatar ? '已选择头像: ' + defaultCommenter.avatar.split(/[/\\]/).pop() : '未选择头像'}</span>
      <button class="dc-select-avatar">选择头像</button>
      <button class="dc-clear">清除</button>
    </div>
  `;

  container.querySelector('.dc-name').addEventListener('change', (e) => {
    defaultCommenter.name = e.target.value;
    renderAnimeList();
  });

  container.querySelector('.dc-select-avatar').addEventListener('click', async () => {
    const files = await window.electronAPI.selectFile({ properties: ['openFile'], filters: [{ name: '图片文件', extensions: ['jpg', 'png', 'jpeg', 'webp'] }] });
    if (files?.length) {
      defaultCommenter.avatar = files[0];
      renderDefaultCommenterUI();
      renderAnimeList();
    }
  });

  container.querySelector('.dc-clear').addEventListener('click', () => {
    defaultCommenter = { name: '', avatar: '' };
    renderDefaultCommenterUI();
    renderAnimeList();
  });
}

function renderAnimeList() {
  const container = document.getElementById('animeList');
  container.innerHTML = '';

  if (!projectData.animes?.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div>1、点击工具栏"从 yuc.wiki 抓取"获取番剧列表，或点击"添加动画"手动添加</div>
        <div>2、输入默认评论昵称并选择头像</div>
        <div>3、在对应动画条目点击添加评论</div>
        <div>4、导入或导出评论</div>
      </div>
    `;
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
      ${anime.staff ? `<div class="anime-detail"><span class="detail-label">制作:</span><span class="detail-text">${escapeHtml(anime.staff)}</span></div>` : ''}
      ${anime.cast ? `<div class="anime-detail"><span class="detail-label">声优:</span><span class="detail-text">${escapeHtml(anime.cast)}</span></div>` : ''}
      <div class="visual-select">
        <span class="visual-path" title="${escapeHtml(anime.visual || '未选择视觉图')}">${anime.visual || '未选择视觉图'}</span>
        <button class="select-visual-btn" data-index="${index}">选择视觉图</button>
      </div>
      <div class="comments-section">
        <div class="comments-header">
          <span>评论 (${comments.length})</span>
          <button class="add-default-comment-btn" data-index="${index}" ${defaultCommenter.name ? '' : 'disabled'}>${defaultCommenter.name ? '添加' + escapeHtml(defaultCommenter.name) + '的评论' : '请先设置默认信息'}</button>
          <button class="add-comment-btn" data-index="${index}">添加评论</button>
        </div>
        <div class="comments-list" data-index="${index}">
          ${comments.map((c, ci) => {
      return `
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
                <button class="select-avatar-btn" data-anime="${index}" data-comment="${ci}">选择头像</button>
                <button class="add-comment-image-btn" data-anime="${index}" data-comment="${ci}" title="插入图片">插入图片</button>
                <button class="delete-comment-btn" data-anime="${index}" data-comment="${ci}">×</button>
              </div>
              <textarea class="comment-text" placeholder="评论内容" data-anime="${index}" data-comment="${ci}">${escapeHtml(c.text || '')}</textarea>
              <div class="comment-images">
                ${(c.images || []).map((img, ii) => `
                  <div class="comment-image-item" data-anime="${index}" data-comment="${ci}" data-image="${ii}">
                    <img src="${escapeHtml(img)}" class="comment-image-thumb" title="点击移除">
                    <button class="remove-comment-image-btn" data-anime="${index}" data-comment="${ci}" data-image="${ii}">×</button>
                  </div>
                `).join('')}
              </div>
            </div>`;
    }).join('')}
        </div>
      </div>`;
    container.appendChild(card);
  });

  bindAnimeEvents();
  updateToggleSelectBtnText();
}

// 从文本中提取图片标记
function extractImageFromText(text) {
  const match = text.match(/\[img:([^\]]+)\]/);
  return match ? match[1] : null;
}

function bindAnimeEvents() {
  document.querySelectorAll('.anime-select').forEach(cb => {
    cb.addEventListener('change', e => {
      const index = parseInt(e.target.dataset.index);
      projectData.animes[index].selected = e.target.checked;

      // 同步更新全选按钮文字
      updateToggleSelectBtnText();
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

  // 普通添加评论
  document.querySelectorAll('.add-comment-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.target.dataset.index);
      projectData.animes[idx].comments = projectData.animes[idx].comments || [];
      projectData.animes[idx].comments.push({ name: '', avatar: '', text: '', medal: '', images: [] });
      renderAnimeList();
    });
  });

  // 带默认值的添加评论
  document.querySelectorAll('.add-default-comment-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const idx = parseInt(e.target.dataset.index);
      if (!defaultCommenter.name) return;

      projectData.animes[idx].comments = projectData.animes[idx].comments || [];
      projectData.animes[idx].comments.push({
        name: defaultCommenter.name,
        avatar: defaultCommenter.avatar,
        text: '',
        medal: '',
        images: []
      });
      renderAnimeList();
    });
  });

  document.querySelectorAll('.comment-name').forEach(input => {
    input.addEventListener('change', e => {
      const { anime, comment } = e.target.dataset;
      if (projectData.animes[anime]?.comments[comment]) {
        projectData.animes[anime].comments[comment].name = e.target.value;
      }
    });
  });

  document.querySelectorAll('.comment-text').forEach(textarea => {
    textarea.addEventListener('change', e => {
      const { anime, comment } = e.target.dataset;
      if (projectData.animes[anime]?.comments[comment]) {
        projectData.animes[anime].comments[comment].text = e.target.value;
      }
    });
  });

  document.querySelectorAll('.comment-medal').forEach(select => {
    select.addEventListener('change', e => {
      const { anime, comment } = e.target.dataset;
      if (projectData.animes[anime]?.comments[comment]) {
        projectData.animes[anime].comments[comment].medal = e.target.value;
      }
    });
  });

  document.querySelectorAll('.select-avatar-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const files = await window.electronAPI.selectFile({ properties: ['openFile'], filters: [{ name: '图片文件', extensions: ['jpg', 'png', 'jpeg', 'webp'] }] });
      if (files?.length) {
        const { anime, comment } = e.target.dataset;
        if (projectData.animes[anime]?.comments[comment]) {
          projectData.animes[anime].comments[comment].avatar = files[0];
          renderAnimeList();
        }
      }
    });
  });

  // 添加评论图片
  document.querySelectorAll('.add-comment-image-btn').forEach(btn => {
    btn.addEventListener('click', async e => {
      const files = await window.electronAPI.selectFile({ properties: ['openFile'], filters: [{ name: '图片文件', extensions: ['jpg', 'png', 'jpeg', 'webp'] }] });
      if (files?.length) {
        const { anime, comment } = e.target.dataset;
        const commentData = projectData.animes[anime]?.comments[comment];
        if (!commentData) return;
        if (!commentData.images) commentData.images = [];

        // 读取文件为 base64 并存储
        const fileData = await window.electronAPI.readFile(files[0]);
        if (fileData.success) {
          const dataUrl = `data:${fileData.mimeType};base64,${fileData.data}`;
          commentData.images.push(dataUrl);
        } else {
          // 如果读取失败，存储文件路径
          commentData.images.push(files[0]);
        }

        renderAnimeList();
      }
    });
  });

  // 删除评论图片
  document.querySelectorAll('.remove-comment-image-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const { anime, comment, image } = e.target.dataset;
      const commentData = projectData.animes[anime]?.comments[comment];
      if (commentData?.images) {
        commentData.images.splice(parseInt(image), 1);
        renderAnimeList();
      }
    });
  });

  document.querySelectorAll('.delete-comment-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      const { anime, comment } = e.target.dataset;
      if (projectData.animes[anime]?.comments) {
        projectData.animes[anime].comments.splice(parseInt(comment), 1);
        renderAnimeList();
      }
    });
  });
}

// 更新全选/取消全选按钮文字
function updateToggleSelectBtnText() {
  const btn = document.getElementById('toggleSelectAllBtn');
  if (!btn) return;

  const animes = projectData.animes;
  if (!animes?.length) {
    btn.textContent = '全选';
    return;
  }

  const allSelected = animes.every(a => a.selected !== false);
  btn.textContent = allSelected ? '取消全选' : '全选';
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

    const fontResult = await window.electronAPI.readAllFonts();

    let fontStyles = '';
    if (fontResult.success) {
      const fonts = fontResult.fonts;
      if (fonts['label.ttf']) fontStyles += `@font-face{font-family:'label';src:url('data:font/ttf;base64,${fonts['label.ttf']}')format('truetype')}`;
      if (fonts['title.ttf']) fontStyles += `@font-face{font-family:'title';src:url('data:font/ttf;base64,${fonts['title.ttf']}')format('truetype')}`;
      if (fonts['footer.ttf']) fontStyles += `@font-face{font-family:'footer';src:url('data:font/ttf;base64,${fonts['footer.ttf']}')format('truetype')}`;
    }

    let html = result.html;
    html = html.replace(/@font-face\s*\{[^}]*\}/g, '');

    if (anime.visual && !anime.visual.startsWith('http') && !anime.visual.startsWith('data:')) {
      const imgData = await window.electronAPI.readFile(anime.visual);
      if (imgData.success) {
        const dataUrl = `data:${imgData.mimeType};base64,${imgData.data}`;
        html = html.replace(/(<img[^>]*class="[^"]*\bvisual-image\b[^"]*"[^>]*src=")[^"]*("[^>]*>)/, `$1${dataUrl}$2`);
      }
    }

    // 处理头像和评论图片
    if (anime.comments) {
      for (const comment of anime.comments) {
        // 处理头像
        if (comment.avatar && !comment.avatar.startsWith('http') && !comment.avatar.startsWith('data:')) {
          const avatarData = await window.electronAPI.readFile(comment.avatar);
          if (avatarData.success) {
            const dataUrl = `data:${avatarData.mimeType};base64,${avatarData.data}`;
            const name = comment.avatar.split(/[/\\]/).pop().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const re = new RegExp(`(<img[^>]*class="[^"]*\\bavatar\\b[^"]*"[^>]*src=")[^"]*${name}[^"]*("[^>]*>)`);
            html = html.replace(re, `$1${dataUrl}$2`);
          }
        }

        // 处理评论中的图片
        if (comment.images && comment.images.length > 0) {
          let imageHtml = '';
          for (const img of comment.images) {
            if (img.startsWith('data:')) {
              imageHtml += `<img src="${img}" style="max-width:100%;height:auto;display:block;margin-top:12px;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.2);max-height:300px;">`;
            } else {
              try {
                const fileData = await window.electronAPI.readFile(img);
                if (fileData.success) {
                  const dataUrl = `data:${fileData.mimeType};base64,${fileData.data}`;
                  imageHtml += `<img src="${dataUrl}" style="max-width:100%;height:auto;display:block;margin-top:12px;border-radius:12px;box-shadow:0 2px 6px rgba(0,0,0,0.2);max-height:300px;">`;
                }
              } catch (err) {
                console.error('评论图片加载失败:', err);
              }
            }
          }

          if (imageHtml) {
            html = html.replace(
              /(<div class="comment-text">[\s\S]*?<\/div>)/,
              `$1${imageHtml}`
            );
          }
        }
      }
    }

    html = html.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');

    const styles = extractStyles(html);
    const body = extractBody(html);
    const fullStyles = fontStyles + '\n' + styles;

    const iframe = document.createElement('iframe');
    iframe.style.cssText = 'width:100%;height:100%;border:none;overflow:auto;background:#fffef5;border-radius:8px;';

    container.innerHTML = '';
    container.appendChild(iframe);

    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(`<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>${fullStyles}</style>
</head>
<body>
  ${body}
  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        var cw = document.querySelector('.comment-wrapper');
        var jt = document.querySelector('.jp-title');
        if (cw && jt) {
          var mh = cw.getBoundingClientRect().bottom - jt.getBoundingClientRect().top;
          jt.style.maxHeight = mh + 'px';
        }
      }, 500);
    });
  </script>
</body>
</html>`);
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