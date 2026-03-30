# Environment Variables

All secrets and configuration go in `.env`. There is no `.env.example`.

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string — required by the Fastify server and import scripts |
| `GEMINI_BASE_URL` | Base URL for the Gemini API proxy (e.g. `https://128api.cn`) |
| `GEMINI_PRO_API_KEY` | API key for Pro-tier Gemini models |
| `GEMINI_FLASH_API_KEY` | API key for Flash-tier Gemini models |

## Startup Behavior

The app throws at startup if `DATABASE_URL` is missing. The error is thrown in `src/infra/db/pool.ts` at module load time.
