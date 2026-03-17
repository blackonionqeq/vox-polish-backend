// ffmpeg convert mp4 to mp3: ffmpeg -i test.mp4 -vn -acodec libmp3lame test.mp3


import dotenv from "dotenv";
import fs from "fs";

dotenv.config()

const base64Audio = fs.readFileSync("./test.mp3", { encoding: "base64" })

const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL;
// const GEMINI_FLASH_API_KEY = process.env.GEMINI_FLASH_API_KEY;
const GEMINI_PRO_API_KEY = process.env.GEMINI_PRO_API_KEY;


const googleFlashModels = [
    "gemini-3-flash-preview",
    "gemini-2.5-flash",
]
const googleProModels = [
    "gemini-3.1-pro-preview",
    "gemini-2.5-pro",
]
// const googleModels = [
//     "gemini-3-pro-preview",
//     "gemini-2.5-pro",
// ];
// const defaultModel = googleFlashModels[0]
const defaultModel = googleProModels[0]

const defaultPrompt = `
    帮我把语音转文字，不用翻译，不用翻译，不用翻译，只需转为文字、起止时间和说话人即可，以便后续生成字幕文件。不用多余的解释，直接返回给定的json格式。
    注意：
    1.字幕起止时间的起点以音频为准，例如第一句话在第三秒处，则from为3，to为第一句话结束的时间
    2.你拿不准的专有名词，可以保留原文，并记录在likes_proper_nouns字段里，方便后续校对
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
        }],
        generationConfig: {
            responseMimeType: "application/json",
            responseSchema: {
                type: "object",
                properties: {
                    transcript_list: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                from: { type: "number" },
                                to: { type: "number" },
                                speaker: { type: "string" },
                                text: { type: "string" },
                            }
                        }
                    },
                    likes_proper_nouns: {
                        type: "array",
                        items: { type: "string" }
                    }
                },
                required: ["transcript_list"]
            }
        }
    })
    console.time("generateTranscriptRequest")
    // 使用 streamGenerateContent 接口并开启 SSE (Server-Sent Events) 模式，可以流式获取即时响应
    // const response = await fetch(`${GEMINI_BASE_URL}/v1beta/models/${params.model}:streamGenerateContent?alt=sse`, {
    const response = await fetch(`${GEMINI_BASE_URL}/v1beta/models/${params.model}:generateContent`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            // "Authorization": `Bearer ${GEMINI_FLASH_API_KEY}`
            "Authorization": `Bearer ${GEMINI_PRO_API_KEY}`
        },
        body
    })
    // 把结果json存在本地
    const result = await response.json()

    // if (!response.ok) {
    //     throw new Error(`HTTP error! status: ${response.status} ${response.statusText}`);
    // }

    // if (!response.body) throw new Error("No response body");

    // const decoder = new TextDecoder();
    // let buffer = "";
    // let finalJsonStr = "";
    
    // console.log("Streaming progress:");

    // // @ts-ignore
    // for await (const chunk of response.body) {
    //     const str = decoder.decode(chunk, { stream: true });
    //     buffer += str;
    //     const lines = buffer.split("\n");
    //     buffer = lines.pop() || "";
        
    //     for (const line of lines) {
    //         if (line.startsWith("data: ")) {
    //             const jsonPart = line.slice(6).trim();
    //             if (!jsonPart) continue;
    //             try {
    //                 const data = JSON.parse(jsonPart);
    //                 const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    //                 if (text) {
    //                     process.stdout.write("."); 
    //                     finalJsonStr += text;
    //                 }
    //             } catch(e) {
    //                 // console.error("Error parsing stream chunk", e);
    //             }
    //         }
    //     }
    // }
    // console.log("\nStream finished.");

    // // 把结果json存在本地
    // let result;
    // try {
    //     result = JSON.parse(finalJsonStr);
    // } catch (e) {
    //     console.error("Failed to parse final JSON. Raw output saved to examples/error-response.txt");
    //     fs.writeFileSync("./examples/error-response.txt", finalJsonStr);
    //     throw e;
    // }



    console.timeEnd("generateTranscriptRequest")
    fs.writeFileSync("./examples/llm-transcript-result.json", JSON.stringify(result, null, 2))
}

generateTranscriptRequest({ model: defaultModel }).then(console.log).catch(console.error)
