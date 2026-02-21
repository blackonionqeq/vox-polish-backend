import type { FastifyInstance } from "fastify";

import { pool } from "../db/pool.js";

type TagRow = {
  name: string;
  count: number;
};

export async function tagsRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/tags", async () => {
    const result = await pool.query<TagRow>(
      `
        SELECT t.name, COUNT(*)::int AS count
        FROM tag t
        JOIN glossary_tag gt ON gt.tag_id = t.id
        GROUP BY t.name
        ORDER BY t.name
      `
    );
    return result.rows;
  });
}

