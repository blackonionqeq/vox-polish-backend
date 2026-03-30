# AGENTS.md

This repository uses this file as the primary instruction entrypoint for coding agents.

## Project Summary

- Node.js + TypeScript ESM project
- Package manager: `pnpm`
- Runtime pattern: TypeScript executed directly with `tsx`
- Main domains:
  - Fastify glossary API in `src/`
  - PostgreSQL data import in `scripts/data/`
  - Gemini-based LLM scripts in `scripts/llm/`

## Start Here

Read this file first, then consult the detailed rule files under `.claude/rules/` as needed:

| Topic | File |
|---|---|
| Dev commands | `.claude/rules/commands.md` |
| Environment variables | `.claude/rules/environment.md` |
| Conventions | `.claude/rules/conventions.md` |
| Fastify glossary API architecture | `.claude/rules/architecture-glossary-api.md` |
| LLM pipeline architecture | `.claude/rules/architecture-llm-pipeline.md` |
| Data import architecture | `.claude/rules/architecture-data-import.md` |

## Working Rules

- Use `pnpm` exclusively. Do not use `npm` or `yarn`.
- Follow ESM conventions. Import local TypeScript modules using `.js` extensions.
- Prefer minimal, targeted changes. Do not refactor unrelated areas.
- Respect the existing module boundaries and current project structure.
- Treat the PostgreSQL pool in `src/infra/db/pool.ts` as a module-level singleton.
- Do not introduce a DI framework.

## Key Commands

```bash
pnpm dev
pnpm tsc --noEmit
pnpm import:words
pnpm import:words:prune
pnpm llm:transcript
pnpm llm:proofreading
pnpm llm:transcript:debug
```

## Environment Notes

- Configuration lives in `.env`.
- `DATABASE_URL` is required by the Fastify server and import scripts.
- Gemini-related scripts depend on the Gemini environment variables documented in `.claude/rules/environment.md`.

## Repository Guidance

- `schema_postgres.sql` is the source of truth for the PostgreSQL schema.
- The import script applies the schema idempotently, then upserts glossary-related tables.
- The glossary API is read-only and backed by PostgreSQL.
- There is no dedicated test suite in the repository at the moment.
- Use `pnpm tsc --noEmit` as the primary verification step after code changes unless the task requires more.

## Compatibility Note

Some tools may also look for `CLAUDE.md` or other tool-specific instruction files. In this repository, `AGENTS.md` is the canonical shared document. Tool-specific files should stay thin and point back here to avoid drift.