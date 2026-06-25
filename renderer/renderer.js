let projectData = {
  title: '新番速递',
  animes: []
};

let selectedAvatarFiles = {};

document.addEventListener('DOMContentLoaded', () => {
  initEventListeners();
  renderAnimeList();
});

function initEventListeners() {
  // 监听日志
  window.electronAPI.onLog((msg) => {
    const logDiv = document.getElementById('log');
    logDiv.innerHTML += `<div>${escapeHtml(msg)}</div>`;
    logDiv.scrollTop = logDiv.scrollHeight;
  });

  // 监听处理完成
  window.electronAPI.onDone((result) => {
    const logDiv = document.getElementById('log');
    if (result && result.outputDir) {
      logDiv.innerHTML +=
        `<div style="color:green;">✅ 处理完成！输出目录: ${result.outputDir}</div>`;
    } else {
      logDiv.innerHTML +=
        `<div style="color:green;">✅ 处理完成！</div>`;
    }
    document.getElementById('exportBtn').disabled = false;
    document.getElementById('exportBtn').textContent = '导出图片';
  });

  // 抓取动画
  document.getElementById('fetchBtn').addEventListener('click', async () => {
    const season = document.getElementById('seasonInput').value || '';
    const logDiv = document.getElementById('log');
    logDiv.innerHTML += `<div>正在抓取 ${season} 季度动画...</div>`;

    try {
      const result = await window.electronAPI.fetchAnimeList(season);
      if (result.success) {
        projectData.animes = result.data;
        renderAnimeList();
        logDiv.innerHTML +=
          `<div style="color:green;">✅ 成功加载 ${result.data.length} 部动画</div>`;
      } else {
        logDiv.innerHTML +=
          `<div style="color:red;">❌ 抓取失败: ${escapeHtml(result.error || '未知错误')}</div>`;
      }
    } catch (err) {
      logDiv.innerHTML +=
        `<div style="color:red;">❌ 抓取异常: ${escapeHtml(err.message)}</div>`;
    }
  });

  // 添加番剧
  document.getElementById('addAnimeBtn').addEventListener('click', () => {
    projectData.animes.push({
      title: '新番名称',
      subtitle: '',
      type: '',
      tags: [],
      visual: '',
      staff: '',
      cast: '',
      broadcast: '',
      comments: [],
      selected: true
    });
    renderAnimeList();
  });

  // 导入 JSON
  document.getElementById('loadJsonBtn').addEventListener('click', async () => {
    try {
      const files = await window.electronAPI.selectFile({
        properties: ['openFile'],
        filters: [{ name: 'JSON 文件', extensions: ['json'] }]
      });
      if (files && files.length) {
        const result = await window.electronAPI.loadJson(files[0]);
        if (result.success) {
          projectData = result.data;
          renderAnimeList();
          document.getElementById('log').innerHTML +=
            `<div style="color:green;">✅ 导入 JSON 成功</div>`;
        } else {
          document.getElementById('log').innerHTML +=
            `<div style="color:red;">❌ 导入失败: ${escapeHtml(result.error)}</div>`;
        }
      }
    } catch (err) {
      document.getElementById('log').innerHTML +=
        `<div style="color:red;">❌ 导入异常: ${escapeHtml(err.message)}</div>`;
    }
  });

  // 导出 JSON
  document.getElementById('saveJsonBtn').addEventListener('click', async () => {
    try {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) {
        const result = await window.electronAPI.saveJson(projectData, dir);
        if (result.success) {
          document.getElementById('log').innerHTML +=
            `<div style="color:green;">✅ JSON 已保存到 ${escapeHtml(dir)}</div>`;
        } else {
          document.getElementById('log').innerHTML +=
            `<div style="color:red;">❌ 保存失败: ${escapeHtml(result.error)}</div>`;
        }
      }
    } catch (err) {
      document.getElementById('log').innerHTML +=
        `<div style="color:red;">❌ 保存异常: ${escapeHtml(err.message)}</div>`;
    }
  });

  // 导出图片
  document.getElementById('exportBtn').addEventListener('click', async () => {
    try {
      const dir = await window.electronAPI.selectDirectory();
      if (dir) {
        document.getElementById('exportBtn').disabled = true;
        document.getElementById('exportBtn').textContent = '处理中...';

        await window.electronAPI.startProcess({
          data: projectData.animes,
          outputDir: dir
        });
      }
    } catch (err) {
      document.getElementById('log').innerHTML +=
        `<div style="color:red;">❌ 处理异常: ${escapeHtml(err.message)}</div>`;
      document.getElementById('exportBtn').disabled = false;
      document.getElementById('exportBtn').textContent = '导出图片';
    }
  });

  // 窗口关闭时清理临时文件
  window.addEventListener('beforeunload', () => {
    window.electronAPI.removeAllListeners?.('log');
  });
}

function renderAnimeList() {
  const container = document.getElementById('animeList');
  container.innerHTML = '';

  if (!projectData.animes || projectData.animes.length === 0) {
    container.innerHTML = '<div class="empty-state">暂无番剧数据，请点击"从 yuc.wiki 抓取"或"添加番剧"</div>';
    return;
  }

  projectData.animes.forEach((anime, index) => {
    const animeCard = document.createElement('div');
    animeCard.className = 'anime-card';

    const comments = Array.isArray(anime.comments) ? anime.comments : [];
    const commentsHtml = comments
      .map(
        (c, ci) => `
      <div class="comment-item" data-anime="${index}" data-comment="${ci}">
        <div class="comment-row">
          <input type="text" class="comment-name" value="${escapeHtml(c.name || '')}"
                 placeholder="昵称" data-anime="${index}" data-comment="${ci}">
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
      )
      .join('');

    const tags = Array.isArray(anime.tags) ? anime.tags : [];
    const tagsHtml = tags
      .map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`)
      .join('');

    // 显示视觉图路径（完整显示）
    const visualPathText = anime.visual ? anime.visual : '未选择视觉图';

    animeCard.innerHTML = `
      <div class="anime-header">
        <input type="checkbox" class="anime-select" data-index="${index}" ${anime.selected !== false ? 'checked' : ''}>
        <span class="anime-index">#${index + 1}</span>
        <input type="text" class="title-input" value="${escapeHtml(anime.title || '')}"
               placeholder="中文标题" data-index="${index}">
        <input type="text" class="subtitle-input" value="${escapeHtml(anime.subtitle || '')}"
               placeholder="日文标题" data-index="${index}">
        <button class="preview-btn" data-index="${index}">预览</button>
        <button class="delete-btn" data-index="${index}">×</button>
      </div>
      <div class="anime-info">
        <span class="info-label">类型: ${escapeHtml(anime.type || '')}</span>
        <div class="tags">${tagsHtml}</div>
        <span class="broadcast">${escapeHtml(anime.broadcast || '')}</span>
      </div>
      <div class="visual-select">
        <span class="visual-path" title="${escapeHtml(visualPathText)}">${visualPathText}</span>
        <button class="select-visual-btn" data-index="${index}">选择视觉图</button>
      </div>
      <div class="comments-section">
        <div class="comments-header">
          <span>评论 (${comments.length})</span>
          <button class="add-comment-btn" data-index="${index}">添加评论</button>
        </div>
        <div class="comments-list" data-index="${index}">
          ${commentsHtml}
        </div>
      </div>
    `;
    container.appendChild(animeCard);
  });

  bindAnimeEvents();
}

function bindAnimeEvents() {
  // 选择框
  document.querySelectorAll('.anime-select').forEach((checkbox) => {
    checkbox.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      if (projectData.animes[index]) {
        projectData.animes[index].selected = e.target.checked;
      }
    });
  });

  // 标题输入
  document.querySelectorAll('.title-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      if (projectData.animes[index]) {
        projectData.animes[index].title = e.target.value;
      }
    });
  });

  // 副标题输入
  document.querySelectorAll('.subtitle-input').forEach((input) => {
    input.addEventListener('change', (e) => {
      const index = parseInt(e.target.dataset.index);
      if (projectData.animes[index]) {
        projectData.animes[index].subtitle = e.target.value;
      }
    });
  });

  // 预览按钮
  document.querySelectorAll('.preview-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      previewAnime(index);
    });
  });

  // 删除番剧
  document.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      if (confirm('确定删除？')) {
        const index = parseInt(e.target.dataset.index);
        projectData.animes.splice(index, 1);
        renderAnimeList();
      }
    });
  });

  // 选择视觉图
  document.querySelectorAll('.select-visual-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      try {
        const index = parseInt(e.target.dataset.index);
        const files = await window.electronAPI.selectFile({
          properties: ['openFile'],
          filters: [{ name: '图片文件', extensions: ['jpg', 'png', 'jpeg', 'webp'] }]
        });
        if (files && files.length) {
          projectData.animes[index].visual = files[0];
          renderAnimeList();
        }
      } catch (err) {
        document.getElementById('log').innerHTML +=
          `<div style="color:red;">选择视觉图失败: ${escapeHtml(err.message)}</div>`;
      }
    });
  });

  // 添加评论
  document.querySelectorAll('.add-comment-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const index = parseInt(e.target.dataset.index);
      if (!projectData.animes[index].comments) {
        projectData.animes[index].comments = [];
      }
      projectData.animes[index].comments.push({
        name: '',
        avatar: '',
        text: '',
        medal: ''
      });
      renderAnimeList();
    });
  });

  // 评论名
  document.querySelectorAll('.comment-name').forEach((input) => {
    input.addEventListener('change', (e) => {
      const ai = parseInt(e.target.dataset.anime);
      const ci = parseInt(e.target.dataset.comment);
      if (projectData.animes[ai] && projectData.animes[ai].comments[ci]) {
        projectData.animes[ai].comments[ci].name = e.target.value;
      }
    });
  });

  // 评论内容
  document.querySelectorAll('.comment-text').forEach((textarea) => {
    textarea.addEventListener('change', (e) => {
      const ai = parseInt(e.target.dataset.anime);
      const ci = parseInt(e.target.dataset.comment);
      if (projectData.animes[ai] && projectData.animes[ai].comments[ci]) {
        projectData.animes[ai].comments[ci].text = e.target.value;
      }
    });
  });

  // 奖牌选择
  document.querySelectorAll('.comment-medal').forEach((select) => {
    select.addEventListener('change', (e) => {
      const ai = parseInt(e.target.dataset.anime);
      const ci = parseInt(e.target.dataset.comment);
      if (projectData.animes[ai] && projectData.animes[ai].comments[ci]) {
        projectData.animes[ai].comments[ci].medal = e.target.value;
      }
    });
  });

  // 选择头像
  document.querySelectorAll('.select-avatar-btn').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      try {
        const ai = parseInt(e.target.dataset.anime);
        const ci = parseInt(e.target.dataset.comment);
        const files = await window.electronAPI.selectFile({
          properties: ['openFile'],
          filters: [{ name: '图片文件', extensions: ['jpg', 'png', 'jpeg', 'webp'] }]
        });
        if (files && files.length) {
          if (projectData.animes[ai] && projectData.animes[ai].comments[ci]) {
            projectData.animes[ai].comments[ci].avatar = files[0];
            renderAnimeList();
          }
        }
      } catch (err) {
        document.getElementById('log').innerHTML +=
          `<div style="color:red;">选择头像失败: ${escapeHtml(err.message)}</div>`;
      }
    });
  });

  // 删除评论
  document.querySelectorAll('.delete-comment-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const ai = parseInt(e.target.dataset.anime);
      const ci = parseInt(e.target.dataset.comment);
      if (projectData.animes[ai] && projectData.animes[ai].comments) {
        projectData.animes[ai].comments.splice(ci, 1);
        renderAnimeList();
      }
    });
  });
}

async function previewAnime(index) {
  const anime = projectData.animes[index];
  if (!anime) return;

  const previewContainer = document.getElementById('previewContainer');
  
  // 显示加载状态
  previewContainer.innerHTML = '<div class="preview-loading">正在生成预览...</div>';

  try {
    const result = await window.electronAPI.generatePreview(anime);
    if (result.success && result.html) {
      // 读取字体文件并注入
      const fontResult = await window.electronAPI.readAllFonts();
      let fontStyles = '';
      
      if (fontResult.success) {
        const fonts = fontResult.fonts;
        if (fonts['label.ttf']) {
          fontStyles += `@font-face {
            font-family: 'label';
            src: url('data:font/ttf;base64,${fonts['label.ttf']}') format('truetype');
          }`;
        }
        if (fonts['title.ttf']) {
          fontStyles += `@font-face {
            font-family: 'title';
            src: url('data:font/ttf;base64,${fonts['title.ttf']}') format('truetype');
          }`;
        }
        if (fonts['footer.ttf']) {
          fontStyles += `@font-face {
            font-family: 'footer';
            src: url('data:font/ttf;base64,${fonts['footer.ttf']}') format('truetype');
          }`;
        }
      }
      
      // 处理 HTML 内容
      let processedHtml = result.html;
      
      // 移除原有的 @font-face 定义
      processedHtml = processedHtml.replace(/@font-face\s*\{[^}]*\}/g, '');
      
      // 修复所有相对路径为 data: URI
      
      // 修复视觉图路径
      if (anime.visual) {
        if (anime.visual.startsWith('http')) {
          // 网络图片保持原样
        } else if (anime.visual.startsWith('data:')) {
          // 已经是 data URI，保持原样
        } else {
          try {
            const imgResult = await window.electronAPI.readFile(anime.visual);
            if (imgResult.success) {
              const dataUrl = `data:${imgResult.mimeType};base64,${imgResult.data}`;
              processedHtml = processedHtml.replace(
                /(<img[^>]*class="[^"]*visual-image[^"]*"[^>]*src=")[^"]*("[^>]*>)/,
                `$1${dataUrl}$2`
              );
            }
          } catch (err) {
            console.error('视觉图嵌入失败:', err);
          }
        }
      }
      
      // 处理所有头像图片
      if (anime.comments && Array.isArray(anime.comments)) {
        for (const comment of anime.comments) {
          if (comment.avatar && !comment.avatar.startsWith('http') && !comment.avatar.startsWith('data:')) {
            try {
              const avatarResult = await window.electronAPI.readFile(comment.avatar);
              if (avatarResult.success) {
                const dataUrl = `data:${avatarResult.mimeType};base64,${avatarResult.data}`;
                // 替换所有匹配的头像 src
                const avatarName = comment.avatar.split(/[/\\]/).pop();
                // 使用更精确的匹配方式
                processedHtml = processedHtml.replace(
                  new RegExp(`src="[^"]*${escapeRegex(avatarName)}[^"]*"`, 'g'),
                  `src="${dataUrl}"`
                );
              }
            } catch (err) {
              console.error('头像嵌入失败:', err);
            }
          }
        }
      }
      
      // 移除所有剩余的相对路径引用（字体文件已移除，图片已替换）
      // 将 ./page-script.js 等引用移除
      processedHtml = processedHtml.replace(/<script[^>]*src="[^"]*"[^>]*><\/script>/g, '');
      
      // 从 HTML 中提取样式和内容
      const styles = extractStyles(processedHtml);
      const bodyContent = extractBody(processedHtml);
      
      // 创建 iframe 来隔离样式
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width: 100%; height: 100%; border: none; overflow: auto; background: #fffef5;';
      
      // 清空预览容器并添加 iframe
      previewContainer.innerHTML = '';
      previewContainer.style.overflow = 'hidden';
      previewContainer.appendChild(iframe);
      
      // 获取 iframe 的文档对象
      const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
      
      // 构建完整的预览文档 - 使用 base64 嵌入所有资源
      const previewDoc = `<!DOCTYPE html>
<html lang="zh">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    ${fontStyles}
    body {
      margin: 0;
      padding: 40px;
      width: 800px;
      font-family: sans-serif;
      background: #fffef5;
      box-sizing: border-box;
    }
    ${styles}
  </style>
</head>
<body>
  ${bodyContent}
  <script>
    // 等待字体和图片加载完成后调整日文标题高度
    window.addEventListener('load', function () {
      setTimeout(function() {
        const commentWrapper = document.querySelector('.comment-wrapper');
        const jpTitle = document.querySelector('.jp-title');
        if (commentWrapper && jpTitle) {
          const wrapperBottom = commentWrapper.getBoundingClientRect().bottom;
          const titleTop = jpTitle.getBoundingClientRect().top;
          const maxH = wrapperBottom - titleTop;
          jpTitle.style.maxHeight = maxH + 'px';
        }
      }, 500);
    });
  </script>
</body>
</html>`;
      
      iframeDoc.open();
      iframeDoc.write(previewDoc);
      iframeDoc.close();
      
      document.getElementById('log').innerHTML +=
        `<div style="color:green;">✅ 预览生成成功</div>`;
    } else {
      previewContainer.innerHTML = `<div class="preview-error">预览生成失败: ${escapeHtml(result.error || '未知错误')}</div>`;
      previewContainer.style.overflow = '';
      document.getElementById('log').innerHTML +=
        `<div style="color:red;">❌ 预览生成失败: ${escapeHtml(result.error || '未知错误')}</div>`;
    }
  } catch (err) {
    previewContainer.innerHTML = `<div class="preview-error">预览异常: ${escapeHtml(err.message)}</div>`;
    previewContainer.style.overflow = '';
    document.getElementById('log').innerHTML +=
      `<div style="color:red;">❌ 预览异常: ${escapeHtml(err.message)}</div>`;
  }
}

// 转义正则表达式特殊字符
function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 从完整 HTML 中提取样式
function extractStyles(html) {
  const styleRegex = /<style>([\s\S]*?)<\/style>/g;
  let styles = '';
  let match;
  while ((match = styleRegex.exec(html)) !== null) {
    styles += match[1] + '\n';
  }
  return styles;
}

// 从完整 HTML 中提取 body 内容
function extractBody(html) {
  const bodyRegex = /<body>([\s\S]*?)<\/body>/i;
  const match = bodyRegex.exec(html);
  if (match) {
    return match[1];
  }
  // 如果没有 body 标签，尝试提取所有标签之间的内容
  const bodyContentRegex = /<body[^>]*>([\s\S]*)<\/body>/i;
  const bodyContentMatch = bodyContentRegex.exec(html);
  if (bodyContentMatch) {
    return bodyContentMatch[1];
  }
  // 最后尝试移除 <!DOCTYPE> 和 <html> 标签
  let content = html
    .replace(/<!DOCTYPE[^>]*>/i, '')
    .replace(/<html[^>]*>/i, '')
    .replace(/<\/html>/i, '')
    .replace(/<head>[\s\S]*?<\/head>/i, '');
  return content;
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}