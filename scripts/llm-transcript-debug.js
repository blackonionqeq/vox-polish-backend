import Fastify from "fastify";
import dotenv from "dotenv";

dotenv.config();

const fastify = Fastify({ logger: true });

const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL || "";
const GEMINI_FLASH_API_KEY = process.env.GEMINI_FLASH_API_KEY || "";

const googleFlashModels = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
];
const googleProModels = [
    "gemini-3-pro-preview",
    "gemini-2.5-pro",
];

// const googleModels = [
//     "gemini-3-pro-preview",
//     "gemini-2.5-pro",
// ];
const defaultModel = googleFlashModels[0];

const defaultPrompt = `
    帮我语音转文字，转写一下听到的内容。为了提高质量，可以先理解大概说了什么，再转写。不用多余的解释，只需给出翻译结果和对应的时间，以便后续生成字幕。直接返回json格式，不要其他任何内容。
`;

fastify.get("/", async (request, reply) => {
    reply.type("text/html").send(`
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Gemini 语音转文字调试器</title>
    <style>
        body { font-family: sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; line-height: 1.6; }
        .card { border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px; background: #f9f9f9; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: bold; }
        input[type="text"], textarea, select { width: 100%; padding: 0.5rem; border: 1px solid #ccc; border-radius: 4px; box-sizing: border-box; }
        button { background: #007bff; color: white; border: none; padding: 0.75rem 1.5rem; border-radius: 4px; cursor: pointer; font-size: 1rem; }
        button:disabled { background: #ccc; cursor: not-allowed; }
        #status { margin-top: 1rem; padding: 1rem; border-radius: 4px; display: none; }
        .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
        .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
        pre { background: #eee; padding: 1rem; overflow-x: auto; border-radius: 4px; max-height: 400px; }
    </style>
</head>
<body>
    <h1>Gemini 语音转文字调试器</h1>
    <p>这个工具将在<strong>客户端浏览器</strong>直接发起 API 请求，方便你使用 Inspector 检查网络封包。</p>

    <div class="card">
        <div class="form-group">
            <label for="baseUrl">API Base URL:</label>
            <input type="text" id="baseUrl" value="${GEMINI_BASE_URL}">
        </div>
        <div class="form-group">
            <label for="apiKey">API Key:</label>
            <input type="text" id="apiKey" value="${GEMINI_FLASH_API_KEY}" placeholder="输入你的 API Key">
        </div>
        <div class="form-group">
            <label for="model">选择模型:</label>
            <select id="model">
                ${googleModels.map(m => `<option value="${m}" ${m === defaultModel ? 'selected' : ''}>${m}</option>`).join('')}
            </select>
        </div>
        <div class="form-group">
            <label for="prompt">Prompt:</label>
            <textarea id="prompt" rows="5">${defaultPrompt.trim()}</textarea>
        </div>
        <div class="form-group">
            <label for="audioFile">选择 MP3 文件:</label>
            <input type="file" id="audioFile" accept="audio/mpeg,audio/mp3">
        </div>
        <button id="startBtn">开始转写</button>
    </div>

    <div id="status"></div>
    
    <div id="resultContainer" style="display:none; margin-top: 2rem;">
        <h3>转写结果:</h3>
        <button id="downloadBtn" style="background: #28a745; margin-bottom: 1rem;">下载 JSON 结果</button>
        <pre id="resultJson"></pre>
    </div>

    <script>
        const startBtn = document.getElementById('startBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        const statusDiv = document.getElementById('status');
        const resultContainer = document.getElementById('resultContainer');
        const resultJson = document.getElementById('resultJson');
        let lastResult = null;

        function showStatus(text, type) {
            statusDiv.textContent = text;
            statusDiv.className = type;
            statusDiv.style.display = 'block';
        }

        function download(content, fileName, contentType) {
            const a = document.createElement("a");
            const file = new Blob([content], { type: contentType });
            a.href = URL.createObjectURL(file);
            a.download = fileName;
            a.click();
            URL.revokeObjectURL(a.href);
        }

        async function fileToBase64(file) {
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.readAsDataURL(file);
                reader.onload = () => resolve(reader.result.split(',')[1]);
                reader.onerror = error => reject(error);
            });
        }

        startBtn.addEventListener('click', async () => {
            const baseUrl = document.getElementById('baseUrl').value;
            const apiKey = document.getElementById('apiKey').value;
            const model = document.getElementById('model').value;
            const prompt = document.getElementById('prompt').value;
            const fileInput = document.getElementById('audioFile');

            if (!apiKey) {
                alert('请输入 API Key');
                return;
            }

            try {
                startBtn.disabled = true;
                resultContainer.style.display = 'none';

                // 允许不选文件发送请求
                let base64Audio = null;
                if (fileInput.files[0]) {
                    showStatus('正在读取文件并进行 Base64 转换...', '');
                    base64Audio = await fileToBase64(fileInput.files[0]);
                } else {
                    showStatus('未选择文件，将仅发送文字 Prompt...', '');
                }
                
                showStatus('正在发送请求到 Gemini API (请打开浏览器控制台查看 Network 选项卡)...', '');

                const _contents = [{ text: prompt }];
                if (base64Audio) {
                    _contents.push({
                        inlineData: {
                            mimeType: "audio/mp3",
                            data: base64Audio
                        }
                    });
                }
                    
                const contents = [{role: "user", parts: _contents}]

                const body = JSON.stringify({ contents });

                const url = \`\${baseUrl}/v1beta/models/\${model}:generateContent\`;
                
                const response = await fetch(url, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": \`Bearer \${apiKey}\`
                    },
                    body
                });

                const result = await response.json();
                lastResult = result;

                if (response.ok) {
                    showStatus('转写成功！', 'success');
                    resultContainer.style.display = 'block';
                    resultJson.textContent = JSON.stringify(result, null, 2);
                } else {
                    showStatus('请求失败: ' + (result.error?.message || response.statusText), 'error');
                    resultContainer.style.display = 'block';
                    resultJson.textContent = JSON.stringify(result, null, 2);
                }
            } catch (error) {
                console.error(error);
                showStatus('发生错误: ' + error.message, 'error');
            } finally {
                startBtn.disabled = false;
            }
        });

        downloadBtn.addEventListener('click', () => {
            if (lastResult) {
                download(JSON.stringify(lastResult, null, 2), 'llm-transcript-result.json', 'application/json');
            }
        });
    </script>
</body>
</html>
    `);
});

const start = async () => {
    try {
        await fastify.listen({ port: 3001, host: '0.0.0.0' });
        console.log("Debug server running at http://localhost:3001");
        console.log("Credentials pre-filled from .env");
    } catch (err) {
        fastify.log.error(err);
        process.exit(1);
    }
};

start();
