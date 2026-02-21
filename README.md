# glossary-management

用于将 `genshin_words.json`（多语言术语表）**可重复导入**到 PostgreSQL，并为后续的 **Fastify API / 大模型翻译**提供可查询的数据基础。

## 背景

这个项目的翻译主场景是**日译中**。为了保证专有名词、固定译名、热词在翻译与润色阶段保持一致，需要把词汇表从 JSON 迁移到数据库，支持：

- **按日文术语精确查找**（主要使用 `ja` 字段）
- **按 tags 过滤**：翻译前让用户勾选 tags，将命中的词条作为大模型“备选热词/专有名词”
- **可增量同步**：JSON 更新后能重复导入，数据库与 JSON 保持一致

## 目标

- **把词表结构化存储到 PostgreSQL**
- **支持 tag 维度检索与扩展**
- 为后续实现提供基础能力：
  - Fastify 提供 API（如 `/tags`、`/glossary/by-tags`）
  - 翻译流水线（可能由 Python/WhisperX 驱动）在润色阶段查询词表

## 数据与结构

### 数据来源

- `genshin_words.json`：一个 JSON 数组，每个 item 约包含：
  - 多语言字段：`en` / `ja` / `zhCN` / `zhTW`
  - `tags`: string[]
  - `variants`: `{ [langCode]: string[] }`（别名/常见误写）
  - `notes*`、`pronunciationJa`、`pinyins`、`zhuyins` 等（可选）

### 数据库表

表结构定义在 `schema_postgres.sql`，核心表如下：

- **`glossary`**：主表（以 `id` 为主键，额外保留 `raw jsonb` 便于回溯）
- **`tag`**：tag 去重表（`name UNIQUE`）
- **`glossary_tag`**：多对多关联（支持用户选择 tags 后快速反查词条）
- **`glossary_variant`**：别名表（按 `lang_code + value` 查询）
- **`glossary_pronunciation`**：拼音/注音等明细（可选）

## 使用方式（TypeScript + pnpm）

### 前置条件

- Node.js 18+（建议 20+）
- pnpm
- PostgreSQL（本地或远程皆可）

### 安装依赖

```bash
pnpm install
```

### 配置数据库连接

脚本默认读取环境变量 `DATABASE_URL`，并已集成 `dotenv`（会自动加载当前目录的 `.env`）。

`.env` 示例：

```bash
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/glossary"
```

### 导入（可重复执行）

```bash
pnpm run import:words
```

脚本 `scripts/import_genshin_words.ts` 的行为：

- 自动执行 `schema_postgres.sql`（表不存在时创建）
- `glossary` 主表按 `id` 做 upsert
- 关联表（tags / variants / 发音）按词条**重建**，确保数据库与 JSON 同步

### 可选：清理已删除词条（prune）

如果 JSON 删除了某些词条，希望数据库也同步删除：

```bash
pnpm run import:words:prune
```

更多细节见 `IMPORT_POSTGRES.md`。

## Fastify API（已实现）

已实现两个最小可用接口用于查询 glossary 数据库，详细说明见 [`FASTIFY_API.md`](FASTIFY_API.md)。

- `GET /tags`：返回所有 tags（含使用次数）  
  - 实现：[`src/routes/tags.ts`](src/routes/tags.ts)
- `GET /glossary/lookup?ja=...`：输入 `ja` 返回对应 `zh_cn`（先精确命中 `glossary.ja`，失败再用 `variants.ja` 兜底）  
  - 实现：[`src/routes/lookup.ts`](src/routes/lookup.ts)

启动服务：

```bash
pnpm run dev
```

## 查询示例（围绕“日译中 + tags”）

### 1) 按日文精确查词（主路径）

```sql
SELECT id, ja, zh_cn, zh_tw, en
FROM glossary
WHERE ja = '燎原烈火の翼';
```

### 2) tags 任一命中（OR）

```sql
SELECT DISTINCT g.id, g.ja, g.zh_cn
FROM glossary g
JOIN glossary_tag gt ON gt.glossary_id = g.id
JOIN tag t ON t.id = gt.tag_id
WHERE t.name = ANY(ARRAY['fatui', 'dialogue']::text[]);
```

### 3) tags 全部命中（AND）

```sql
SELECT g.id, g.ja, g.zh_cn
FROM glossary g
JOIN glossary_tag gt ON gt.glossary_id = g.id
JOIN tag t ON t.id = gt.tag_id
WHERE t.name = ANY(ARRAY['fatui', 'sumeru']::text[])
GROUP BY g.id
HAVING COUNT(DISTINCT t.name) = 2;
```

### 4) 日文别名命中（variants）

```sql
SELECT g.id, g.ja, g.zh_cn
FROM glossary g
JOIN glossary_variant v ON v.glossary_id = g.id
WHERE v.lang_code = 'ja' AND v.value = '西洋鍋';
```

## 索引建议（与你的场景强相关）

当前 schema 已包含：
- `glossary_tag (tag_id, glossary_id)`：加速“选 tags -> 找词条”
- `glossary_variant (lang_code, value)`：加速“按别名查词条”

如果你的查询主要是 `WHERE ja = ...`，建议额外添加：

```sql
CREATE INDEX IF NOT EXISTS idx_glossary_ja ON glossary (ja);
```

> 备注：若未来需要“包含/模糊匹配”（比如 ASR 带噪声），再考虑 `pg_trgm` 的 trigram 索引会更合适。

## Windows / psql 编码常见坑

在 Windows 上用 `psql` 查询中日文时，常见问题是终端默认 GBK，导致 UTF-8 无法显示/输入。

建议：

- 在 PowerShell 先切 UTF-8 再启动 `psql`：

```powershell
chcp 65001
$OutputEncoding = [Console]::OutputEncoding = [System.Text.UTF8Encoding]::new()
```

- 在 `psql` 内执行：

```sql
\encoding UTF8
SHOW client_encoding;
```

- SQL 字符串务必用标准**单引号**：`'...'`（不要用中文弯引号）

## 后续计划（建议）

- **Fastify API**
  - `GET /tags`：返回所有 tags（含使用次数）（已实现）
  - `POST /glossary/by-tags`：按 tags 返回词条（支持 any/all）
  - `GET /glossary/lookup?ja=...`：按 `ja`/`variants.ja` 查找（已实现）
- **翻译流水线（Python）对接**
  - 翻译前先查词表，把命中项作为 `hard_terms`
  - 再把用户所选 tags 下的相关词条作为 `soft_terms`
  - 提示大模型：`hard_terms` 必须优先使用，`soft_terms` 仅作润色参考
