import Fastify from "fastify";

import { closePool } from "./db/pool.js";
import { lookupRoutes } from "./routes/lookup.js";
import { tagsRoutes } from "./routes/tags.js";

async function main(): Promise<void> {
  const fastify = Fastify({ logger: true });

  fastify.addHook("onClose", async () => {
    await closePool();
  });

  await fastify.register(tagsRoutes);
  await fastify.register(lookupRoutes);

  const port = process.env.PORT ? Number(process.env.PORT) : 3000;
  const host = process.env.HOST ?? "0.0.0.0";

  await fastify.listen({ port, host });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

