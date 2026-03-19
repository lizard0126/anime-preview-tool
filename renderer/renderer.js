// 存储选择的头像文件路径数组
let selectedAvatarFiles = [];

// 等 DOM 加载完成再绑定事件
document.addEventListener('DOMContentLoaded', () => {

    // 监听日志
    window.electronAPI.onLog((msg) => {
        const logDiv = document.getElementById('log');
        logDiv.innerHTML += `<div>${msg}</div>`;
        logDiv.scrollTop = logDiv.scrollHeight;
    });

    // 监听处理完成
    window.electronAPI.onDone((result) => {
        document.getElementById('log').innerHTML += `<div style="color:green;">✅ 处理完成！输出目录: ${result.outputDir}</div>`;
        document.getElementById('startBtn').disabled = false;
    });

    // DOCX 文件选择
    document.getElementById('browseDocx').addEventListener('click', async () => {
        const files = await window.electronAPI.selectFile({
            properties: ['openFile'],
            filters: [{ name: 'DOCX 文件', extensions: ['docx'] }]
        });
        if (files.length) {
            document.getElementById('docxPath').value = files[0];
        }
    });

    // 输出目录选择
    document.getElementById('browseOutput').addEventListener('click', async () => {
        const dir = await window.electronAPI.selectDirectory();
        if (dir) {
            document.getElementById('outputDir').value = dir;
        }
    });

    // 头像文件选择（多选）
    document.getElementById('browseAvatars').addEventListener('click', async () => {
        const files = await window.electronAPI.selectFiles({
            filters: [
                { name: '图片文件', extensions: ['jpg', 'jpeg', 'png', 'gif'] }
            ]
        });
        if (files.length) {
            selectedAvatarFiles = files;
            const avatarList = document.getElementById('avatarList');
            avatarList.innerHTML = files.map(f => `📷 ${pathBasename(f)}`).join('<br>');
            document.getElementById('avatarFiles').value = `已选择 ${files.length} 个文件`;
        }
    });

    // 表单提交
    document.getElementById('configForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const docxPathInput = document.getElementById('docxPath');
        const outputDirInput = document.getElementById('outputDir');

        if (!docxPathInput || !outputDirInput) {
            alert('页面元素缺失，请检查 HTML');
            return;
        }

        const docxPath = docxPathInput.value.trim();
        const outputDir = outputDirInput.value.trim();

        if (!docxPath || !outputDir) {
            alert('请填写所有必填项');
            return;
        }

        // 禁用按钮
        document.getElementById('startBtn').disabled = true;
        document.getElementById('log').innerHTML = ''; // 清空日志

        const config = {
            docxPath,
            avatarFiles: selectedAvatarFiles,
            outputDir
        };

        await window.electronAPI.startProcess(config);
    });

});

// 辅助函数，用于显示文件名
function pathBasename(p) {
    return p.split(/[\\/]/).pop();
}