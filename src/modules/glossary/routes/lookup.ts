import type { FastifyInstance } from "fastify";

import { pool } from "../../../infra/db/pool.js";

type LookupQuery = {
  ja?: string;
};

type LookupRow = {
  id: string;
  ja: string | null;
  zh_cn: string | null;
};

export async function lookupRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Querystring: LookupQuery }>("/glossary/lookup", async (request, reply) => {
    const ja = typeof request.query.ja === "string" ? request.query.ja.trim() : "";
    if (!ja) {
      return reply.code(400).send({ error: 'Missing required query parameter "ja".' });
    }

    const exact = await pool.query<LookupRow>(
      `
        SELECT id, ja, zh_cn
        FROM glossary
        WHERE ja = $1
        LIMIT 1
      `,
      [ja]
    );
    if (exact.rows[0]) {
      const row = exact.rows[0];
      return {
        id: row.id,
        ja: row.ja,
        zh_cn: row.zh_cn,
        matched_by: "ja" as const
      };
    }

    const byVariant = await pool.query<LookupRow>(
      `
        SELECT g.id, g.ja, g.zh_cn
        FROM glossary_variant v
        JOIN glossary g ON g.id = v.glossary_id
        WHERE v.lang_code = 'ja' AND v.value = $1
        LIMIT 1
      `,
      [ja]
    );
    if (byVariant.rows[0]) {
      const row = byVariant.rows[0];
      return {
        id: row.id,
        ja: row.ja,
        zh_cn: row.zh_cn,
        matched_by: "variant" as const
      };
    }

    return reply.code(404).send({ error: "Not found." });
  });
}
