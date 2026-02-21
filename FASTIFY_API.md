# Fastify API（已实现）

本项目已提供最小可用的 Fastify 后端，用于从 PostgreSQL 的 glossary 数据库中查询并返回内容（面向“日译中 + tags”场景）。

## 启动

确保已配置 `DATABASE_URL`（见 [README.md](README.md) 的 `.env` 示例），并已导入数据：

```bash
pnpm run import:words
pnpm run dev
```

默认监听：`http://127.0.0.1:3000`

## 接口

### `GET /tags`

返回所有 tags（含使用次数）：

```json
[
  { "name": "artifact", "count": 63 },
  { "name": "character-sub", "count": 1083 }
]
```

实现见：[`src/routes/tags.ts`](src/routes/tags.ts)

### `GET /glossary/lookup?ja=...`

输入 `ja` 返回对应 `zh_cn`（先精确命中 `glossary.ja`，失败再用 `glossary_variant(lang_code='ja')` 兜底）：

```json
{
  "id": "wings-of-soaring-flame",
  "ja": "燎原烈火の翼",
  "zh_cn": "烈火腾燎之翼",
  "matched_by": "ja"
}
```

- `matched_by = "ja"`：命中 `glossary.ja = $1`
- `matched_by = "variant"`：命中 `glossary_variant.value = $1`（`lang_code='ja'`）

实现见：[`src/routes/lookup.ts`](src/routes/lookup.ts)

## 相关文件

- 服务入口：[`src/server.ts`](src/server.ts)
- 数据库连接池：[`src/db/pool.ts`](src/db/pool.ts)
- tags 路由：[`src/routes/tags.ts`](src/routes/tags.ts)
- lookup 路由：[`src/routes/lookup.ts`](src/routes/lookup.ts)

