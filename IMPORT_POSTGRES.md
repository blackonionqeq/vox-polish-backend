# 导入 `genshin_words.json` 到 PostgreSQL（TypeScript + pnpm）

## 1) 安装依赖

```bash
pnpm install
```

## 2) 准备数据库连接

推荐用环境变量 `DATABASE_URL`：

```bash
# PowerShell
$env:DATABASE_URL = "postgresql://postgres:postgres@localhost:5432/glossary"
```

也可以在命令里传 `--dsn`。

## 3) 执行导入（可重复执行）

```bash
pnpm run import:words
```

脚本行为：
- 自动执行 `schema_postgres.sql`（表不存在时创建）
- 主表按 `id` 做 upsert（存在则更新）
- 关联表（tags / variants / 发音）按词条重建，保证与 JSON 同步

## 4) 可选：清理已删除词条

如果 JSON 删除了某些词条，希望数据库也删除，使用：

```bash
pnpm run import:words:prune
```

## 5) 直接运行脚本（可指定文件和 DSN）

```bash
pnpm tsx scripts/import_genshin_words.ts --json genshin_words.json --dsn "postgresql://postgres:postgres@localhost:5432/glossary"
```

## 6) 示例查询

### 查询用户选中 tags（任一命中）

```sql
SELECT DISTINCT g.id, g.en, g.ja, g.zh_cn, g.zh_tw
FROM glossary g
JOIN glossary_tag gt ON gt.glossary_id = g.id
JOIN tag t ON t.id = gt.tag_id
WHERE t.name = ANY(ARRAY['fatui', 'dialogue']::text[]);
```

### 查询用户选中 tags（全部命中）

```sql
SELECT g.id, g.en, g.ja, g.zh_cn, g.zh_tw
FROM glossary g
JOIN glossary_tag gt ON gt.glossary_id = g.id
JOIN tag t ON t.id = gt.tag_id
WHERE t.name = ANY(ARRAY['fatui', 'sumeru']::text[])
GROUP BY g.id
HAVING COUNT(DISTINCT t.name) = 2;
```

## 7) 后续接 Fastify 的建议

- 建议把 `scripts/import_genshin_words.ts` 里的查询逻辑拆成 `src/db/` 下的函数。
- Fastify 里先做两个 API：
  - `GET /tags`：返回可选 tag 列表
  - `POST /glossary/by-tags`：入参为 tag 数组 + 匹配模式（`any` / `all`）
- 翻译前先查词表，把结果作为 `hard_terms` 喂给大模型。
