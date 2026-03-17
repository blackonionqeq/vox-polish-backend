import dotenv from "dotenv";
import fs from "fs";

dotenv.config();

const GEMINI_BASE_URL = process.env.GEMINI_BASE_URL;
const GEMINI_PRO_API_KEY = process.env.GEMINI_PRO_API_KEY;

const googleProModels = ["gemini-3-pro-preview", "gemini-2.5-pro"] as const;
const defaultModel = googleProModels[0];

function mustGetEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`缺少环境变量：${name}`);
  return v;
}

function extractFirstJsonObject(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("无法从文本中抽取 JSON 对象");
  }
  const sliced = text.slice(start, end + 1);
  return JSON.parse(sliced);
}

function getGeminiTextParts(result: any): string {
  const parts: any[] = result?.candidates?.[0]?.content?.parts ?? [];
  const text = parts
    .map((p) => (typeof p?.text === "string" ? p.text : ""))
    .filter(Boolean)
    .join("\n");
  if (!text) throw new Error("Gemini 返回为空或不含 text");
  return text;
}

function extractSrtFromText(text: string): string {
  const fenced = text.match(/```(?:srt)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim() + "\n";
  return text.trim() + "\n";
}

type TranscriptItem = {
  from: number;
  to: number;
  speaker: string;
  text: string;
};

type TranscriptPayload = {
  transcript_list: TranscriptItem[];
  likes_proper_nouns?: string[];
};

function getProperNounsPromptSection(transcript: TranscriptPayload): string[] {
  const properNouns = (transcript.likes_proper_nouns ?? [])
    .map((item) => item.trim())
    .filter(Boolean);

  if (properNouns.length === 0) {
    return [];
  }

  return [
    "",
    "下面这些词是转写阶段标记出的疑似专有名词，请在润色时重点处理：",
    "- 结合上下文判断它们是否应修正为更准确、更统一的专有名词写法。",
    "- 如果能确定标准写法，请在最终字幕中统一替换。",
    "- 如果仍无法确定，请保留原文，不要臆造。",
    `疑似专有名词：${properNouns.join("、")}`,
  ];
}

function parseTranscriptPayloadFromFile(raw: string): TranscriptPayload {
  const top = JSON.parse(raw);

  // 兼容：文件本身已经是 transcript_list 的 JSON
  if (top && typeof top === "object" && Array.isArray((top as any).transcript_list)) {
    return top as TranscriptPayload;
  }

  // 兼容：llm-transcipt.ts 写入的 Gemini response，真正 JSON 在 candidates[0].content.parts[0].text
  const maybeText = top?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof maybeText !== "string") {
    throw new Error("输入文件不是预期的 Gemini response，也不是 transcript_list JSON");
  }

  try {
    return JSON.parse(maybeText) as TranscriptPayload;
  } catch {
    return extractFirstJsonObject(maybeText) as TranscriptPayload;
  }
}

async function generateSrtByGemini(params: { model: string; transcript: TranscriptPayload }) {
  const baseUrl = mustGetEnv("GEMINI_BASE_URL");
  const apiKey = mustGetEnv("GEMINI_PRO_API_KEY");
  const properNounsPromptSection = getProperNounsPromptSection(params.transcript);

  const prompt = [
    "你是专业字幕润色与排版助手。",
    "我会给你一段语音转写结果 JSON（transcript_list）。请完成：",
    "- 保持原意，不翻译；纠正错别字与标点；让口语更自然但不要过度改写。",
    "- 如果提供了疑似专有名词列表，请优先结合上下文校对并统一这些词的写法。",
    "- 合理断句，避免一条字幕过长；必要时可把同一条拆成多条，但时间必须落在原区间内且不重叠。",
    "- 输出必须是严格的 SRT 格式：",
    "  1) 序号从 1 开始递增",
    "  2) 时间格式为 HH:MM:SS,mmm --> HH:MM:SS,mmm",
    "  3) 每条字幕内容为单行或双行，建议第一行加说话人前缀：例如「【男孩1】xxx」",
    "- 不要输出任何解释、不要输出 JSON、不要输出多余的 markdown，只输出 SRT 正文。",
    ...properNounsPromptSection,
    "",
    "下面是 transcript JSON：",
    JSON.stringify(params.transcript),
  ].join("\n");

  const body = JSON.stringify({
    contents: [
      {
        role: "user",
        parts: [{ text: prompt }],
      },
    ],
  });

  console.time("gemini:proofreading");
  const controller = new AbortController();
  const timeoutMs = Number(process.env.GEMINI_TIMEOUT_MS ?? 3000_000);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${baseUrl}/v1beta/models/${params.model}:generateContent`;
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Gemini 请求失败：HTTP ${response.status} ${response.statusText}\n${errText}`);
  }

  const result = await response.json();
  console.timeEnd("gemini:proofreading");

  const text = getGeminiTextParts(result);
  const srt = extractSrtFromText(text);
  fs.writeFileSync("./examples/test.srt", srt, "utf-8");
}

async function main() {
  if (!GEMINI_BASE_URL) throw new Error("缺少 GEMINI_BASE_URL");
  if (!GEMINI_PRO_API_KEY) throw new Error("缺少 GEMINI_PRO_API_KEY");

  const inputRaw = fs.readFileSync("./examples/llm-transcript-result.json", "utf-8");
  const transcript = parseTranscriptPayloadFromFile(inputRaw);

  // 1) 覆盖写入：抽取到的 transcript JSON
  fs.writeFileSync("./examples/llm-proofreading-result.json", JSON.stringify(transcript, null, 2), "utf-8");

  // 2~3) 调用 Gemini Pro 润色并输出 SRT
  const fallbackModels = [defaultModel, ...googleProModels.filter((m) => m !== defaultModel)];
  let lastErr: unknown;
  for (const model of fallbackModels) {
    try {
      await generateSrtByGemini({ model, transcript });
      return;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

main()
  .then(console.log)
  .catch((e) => {
    process.exitCode = 1;
    console.error(e);
  });
