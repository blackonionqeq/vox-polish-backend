# Dev Commands

## Fastify API Server

```bash
pnpm dev          # Start API server on port 3000
```

## LLM Scripts

These run standalone against `test.mp3` / `examples/`:

```bash
pnpm llm:transcript          # MP3 → Gemini → examples/llm-transcript-result.json
pnpm llm:proofreading        # llm-transcript-result.json → Gemini → examples/test.srt
pnpm llm:transcript:debug    # Browser debug UI at http://localhost:3001
```

## Data Import

```bash
pnpm import:words            # Upsert genshin_words.json into PostgreSQL
pnpm import:words:prune      # Same, but delete DB rows absent from JSON
```

## Type Checking

There is no build step and no test suite. TypeScript is run directly via `tsx`.

```bash
pnpm tsc --noEmit
```

## Update Dictionary Data

```bash
bash udpate_json.sh   # Downloads fresh genshin_words.json from dataset.genshin-dictionary.com
```
