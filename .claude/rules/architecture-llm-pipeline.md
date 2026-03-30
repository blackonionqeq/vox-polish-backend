# Architecture: LLM Transcription Pipeline

Source root: `scripts/llm/`

Standalone scripts using the Gemini API (via third-party proxy at `GEMINI_BASE_URL`) for audio processing.

## Scripts

### `transcript.ts`

- Reads `test.mp3` as Base64
- Sends to Gemini for Japanese transcription
- Outputs structured JSON to `examples/llm-transcript-result.json`
- Output format: array of timestamped segments with `from` / `to` / `speaker` / `text`

### `proofreading.ts`

- Reads transcript JSON from `examples/llm-transcript-result.json`
- Sends to Gemini Pro to proofread and format as strict SRT
- Outputs `examples/test.srt`
- Configurable timeout via `GEMINI_TIMEOUT_MS` env var (default: 50 minutes)
- Has a model fallback list (tries next model if current one fails)

### `transcript-debug.js`

- Fastify server on port 3001
- Serves a self-contained HTML UI for testing Gemini API requests directly from the browser with DevTools inspection

## Data Flow

```
test.mp3
  → transcript.ts
  → examples/llm-transcript-result.json   (raw Gemini API response)
  → proofreading.ts  (unwraps response to get transcript array)
  → examples/test.srt
```

**Note**: `examples/llm-transcript-result.json` stores the **raw Gemini API response**. `proofreading.ts` unwraps it to get the actual transcript array. Both scripts also accept a direct transcript JSON array as input.
