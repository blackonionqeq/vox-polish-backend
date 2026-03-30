# Architecture: Fastify Glossary API

Source root: `src/`

A read-only HTTP API serving a multilingual Genshin Impact glossary from PostgreSQL. Used to support Japanese → Chinese translation pipelines.

## Entry Point

`src/app/server.ts` — registers route plugins, hooks pool shutdown to server close.

## Database

`src/infra/db/pool.ts` — singleton `pg.Pool`, loaded once at module level, shared across all routes. No DI framework.

## Routes

| Route | File | Description |
|---|---|---|
| `GET /tags` | `src/modules/glossary/routes/tags.ts` | All tags with usage counts |
| `GET /glossary/lookup?ja=<term>` | `src/modules/glossary/routes/lookup.ts` | Two-pass lookup: exact match on `glossary.ja`, fallback to `glossary_variant` |

## Schema

Defined in `schema_postgres.sql`. Five tables:

- `glossary`
- `tag`
- `glossary_tag`
- `glossary_variant`
- `glossary_pronunciation`

The schema is applied idempotently by the import script.
