// ffmpeg convert mp4 to mp3: ffmpeg -i input.mp4 -vn -acodec libmp3lame output.mp3


import dotenv from "dotenv";
import fs from "fs";

dotenv.config()

const base64Audio = fs.readFileSync("./test.mp3", { encoding: "base64" })

const OPENAI_BASE_URL = process.env.OPENAI_BASE_URL;
const GEMINI_FLASH_API_KEY = process.env.GEMINI_FLASH_API_KEY;


const googleFlashModels = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
]
const googleProModels = [
    "gemini-3-pro-preview",
    "gemini-2.5-pro",
]
// const googleModels = [
//     "gemini-3-pro-preview",
//     "gemini-2.5-pro",
// ];
const defaultModel = googleFlashModels[0]

const defaultPrompt = `
    帮我语音转文字，不用翻译，只需转为文字和时间即可，以便后续生成字幕。不用多余的解释，直接返回json格式。
`

// generate a transcript request to gemini
async function generateTranscriptRequest(params: {
    model: string;
}) {
    const body = JSON.stringify({
        contents: [{
            role: "user",
            parts: [
                {
                    text: defaultPrompt
                },
                {
                    inlineData: { mimeType: "audio/mp3", data: base64Audio }
                }
            ]
        }]
    })
    console.time("generateTranscriptRequest")
    const response = await fetch(`${OPENAI_BASE_URL}/v1beta/models/${params.model}:generateContent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${GEMINI_FLASH_API_KEY}`
        },
        body
    })
    // 把结果json存在本地
    const result = await response.json()
    console.timeEnd("generateTranscriptRequest")
    fs.writeFileSync("./llm-transcript-result.json", JSON.stringify(result, null, 2))
}

generateTranscriptRequest({ model: defaultModel }).then(console.log).catch(console.error)