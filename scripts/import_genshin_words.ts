import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";
import dotenv from "dotenv";

dotenv.config();

type PronunciationRecord = {
  char?: unknown;
  pron?: unknown;
};

type GlossaryItem = {
  id?: unknown;
  en?: unknown;
  ja?: unknown;
  zhCN?: unknown;
  zhTW?: unknown;
  pronunciationJa?: unknown;
  notes?: unknown;
  notesEn?: unknown;
  notesZh?: unknown;
  notesZhTW?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  tags?: unknown;
  variants?: unknown;
  pinyins?: unknown;
  zhuyins?: unknown;
  [key: string]: unknown;
};

type CliOptions = {
  jsonPath: string;
  dsn?: string;
  prune: boolean;
};

function parseArgs(argv: string[]): CliOptions {
  let jsonPath = "genshin_words.json";
  let dsn = process.env.DATABASE_URL;
  let prune = false;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--json" && argv[i + 1]) {
      jsonPath = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--dsn" && argv[i + 1]) {
      dsn = argv[i + 1];
      i += 1;
      continue;
    }
    if (arg === "--prune") {
      prune = true;
      continue;
    }
  }

  return { jsonPath, dsn, prune };
}

function asNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const v = value.trim();
  return v.length > 0 ? v : null;
}

function asDateOrNull(value: unknown): string | null {
  // Keep DATE parsing in PostgreSQL side (ISO yyyy-mm-dd string).
  const v = asNonEmptyString(value);
  return v;
}

function extractVariants(item: GlossaryItem): Array<{ langCode: string; value: string }> {
  const variants: Array<{ langCode: string; value: string }> = [];
  const source = item.variants;
  if (!source || typeof source !== "object" || Array.isArray(source)) {
    return variants;
  }

  for (const [langCode, values] of Object.entries(source as Record<string, unknown>)) {
    if (!Array.isArray(values)) {
      continue;
    }
    for (const value of values) {
      const parsed = asNonEmptyString(value);
      if (parsed) {
        variants.push({ langCode, value: parsed });
      }
    }
  }
  return variants;
}

function extractPronunciations(item: GlossaryItem): Array<{ system: string; char: string; pron: string }> {
  const output: Array<{ system: string; char: string; pron: string }> = [];
  const sourceList: Array<{ system: string; key: "pinyins" | "zhuyins" }> = [
    { system: "pinyin", key: "pinyins" },
    { system: "zhuyin", key: "zhuyins" }
  ];

  for (const source of sourceList) {
    const records = item[source.key];
    if (!Array.isArray(records)) {
      continue;
    }
    for (const raw of records) {
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
        continue;
      }
      const rec = raw as PronunciationRecord;
      const char = asNonEmptyString(rec.char);
      const pron = asNonEmptyString(rec.pron);
      if (char && pron) {
        output.push({ system: source.system, char, pron });
      }
    }
  }

  return output;
}

function extractTags(item: GlossaryItem): string[] {
  const rawTags = item.tags;
  if (!Array.isArray(rawTags)) {
    return [];
  }
  const tags = rawTags
    .map((tag) => asNonEmptyString(tag))
    .filter((tag): tag is string => Boolean(tag));
  return Array.from(new Set(tags));
}

async function ensureSchema(client: Client): Promise<void> {
  const currentFile = fileURLToPath(import.meta.url);
  const currentDir = path.dirname(currentFile);
  const schemaPath = path.resolve(currentDir, "../schema_postgres.sql");
  const sql = await fs.readFile(schemaPath, "utf-8");
  await client.query(sql);
}

async function importOne(client: Client, item: GlossaryItem & { id: string }): Promise<void> {
  const glossaryId = item.id;
  const rawJson = JSON.stringify(item);

  await client.query(
    `
      INSERT INTO glossary (
        id, en, ja, zh_cn, zh_tw, pronunciation_ja,
        notes, notes_en, notes_zh, notes_zh_tw,
        created_at, updated_at, source_updated_at, raw
      )
      VALUES (
        $1, $2, $3, $4, $5, $6,
        $7, $8, $9, $10,
        $11, $12, $13, $14::jsonb
      )
      ON CONFLICT (id) DO UPDATE SET
        en = EXCLUDED.en,
        ja = EXCLUDED.ja,
        zh_cn = EXCLUDED.zh_cn,
        zh_tw = EXCLUDED.zh_tw,
        pronunciation_ja = EXCLUDED.pronunciation_ja,
        notes = EXCLUDED.notes,
        notes_en = EXCLUDED.notes_en,
        notes_zh = EXCLUDED.notes_zh,
        notes_zh_tw = EXCLUDED.notes_zh_tw,
        created_at = EXCLUDED.created_at,
        updated_at = EXCLUDED.updated_at,
        source_updated_at = EXCLUDED.source_updated_at,
        raw = EXCLUDED.raw
    `,
    [
      glossaryId,
      asNonEmptyString(item.en),
      asNonEmptyString(item.ja),
      asNonEmptyString(item.zhCN),
      asNonEmptyString(item.zhTW),
      asNonEmptyString(item.pronunciationJa),
      asNonEmptyString(item.notes),
      asNonEmptyString(item.notesEn),
      asNonEmptyString(item.notesZh),
      asNonEmptyString(item.notesZhTW),
      asDateOrNull(item.createdAt),
      asDateOrNull(item.updatedAt),
      asDateOrNull(item.updatedAt),
      rawJson
    ]
  );

  await client.query("DELETE FROM glossary_tag WHERE glossary_id = $1", [glossaryId]);
  for (const tagName of extractTags(item)) {
    await client.query(
      `
        INSERT INTO tag (name) VALUES ($1)
        ON CONFLICT (name) DO NOTHING
      `,
      [tagName]
    );
    await client.query(
      `
        INSERT INTO glossary_tag (glossary_id, tag_id)
        SELECT $1, id FROM tag WHERE name = $2
        ON CONFLICT DO NOTHING
      `,
      [glossaryId, tagName]
    );
  }

  await client.query("DELETE FROM glossary_variant WHERE glossary_id = $1", [glossaryId]);
  for (const variant of extractVariants(item)) {
    await client.query(
      `
        INSERT INTO glossary_variant (glossary_id, lang_code, value)
        VALUES ($1, $2, $3)
        ON CONFLICT DO NOTHING
      `,
      [glossaryId, variant.langCode, variant.value]
    );
  }

  await client.query("DELETE FROM glossary_pronunciation WHERE glossary_id = $1", [glossaryId]);
  for (const rec of extractPronunciations(item)) {
    await client.query(
      `
        INSERT INTO glossary_pronunciation (glossary_id, system, char, pron)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT DO NOTHING
      `,
      [glossaryId, rec.system, rec.char, rec.pron]
    );
  }
}

async function pruneMissing(client: Client, validIds: string[]): Promise<number> {
  const result = await client.query<{ id: string }>("SELECT id FROM glossary");
  const existing = new Set(result.rows.map((row) => row.id));
  const valid = new Set(validIds);
  const toDelete = Array.from(existing).filter((id) => !valid.has(id));
  if (toDelete.length === 0) {
    return 0;
  }
  await client.query("DELETE FROM glossary WHERE id = ANY($1::text[])", [toDelete]);
  return toDelete.length;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  if (!options.dsn) {
    throw new Error("Missing DB connection. Use --dsn or set DATABASE_URL.");
  }

  const raw = await fs.readFile(options.jsonPath, "utf-8");
  const parsed = JSON.parse(raw);
  if (!Array.isArray(parsed)) {
    throw new Error("Invalid JSON format: expected top-level array.");
  }

  const client = new Client({ connectionString: options.dsn });
  await client.connect();

  let imported = 0;
  const ids: string[] = [];
  let pruned = 0;

  try {
    await client.query("BEGIN");
    await ensureSchema(client);

    for (let i = 0; i < parsed.length; i += 1) {
      const item = parsed[i];
      if (!item || typeof item !== "object" || Array.isArray(item)) {
        continue;
      }
      const glossaryId = asNonEmptyString((item as GlossaryItem).id);
      if (!glossaryId) {
        // Keep importing even if some records are malformed.
        console.warn(`Skip record #${i + 1}: invalid id`);
        continue;
      }
      const normalized: GlossaryItem & { id: string } = {
        ...(item as GlossaryItem),
        id: glossaryId
      };
      await importOne(client, normalized);
      imported += 1;
      ids.push(glossaryId);
    }

    if (options.prune) {
      pruned = await pruneMissing(client, ids);
    }

    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    await client.end();
  }

  console.log(`Imported/updated: ${imported}`);
  if (options.prune) {
    console.log(`Pruned missing rows: ${pruned}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
