# Key Conventions

## Module System

- `"type": "module"` in `package.json` — the entire project is ESM
- Use `.js` extensions in all import paths, even when importing `.ts` source files (NodeNext module resolution)

```ts
// Correct
import { pool } from '../../infra/db/pool.js'

// Wrong
import { pool } from '../../infra/db/pool'
```

## Dependency Injection

No DI framework. The DB pool (`src/infra/db/pool.ts`) is a module-level singleton imported directly wherever needed.

## Package Manager

Use **pnpm** exclusively. Do not use `npm` or `yarn`.

## Fastify Version

Fastify v5. Route plugins use the async function pattern:

```ts
export default async function routes(fastify: FastifyInstance) {
  fastify.get('/path', async (request, reply) => { ... })
}
```
