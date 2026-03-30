# Architecture: Data Import

Source: `scripts/data/import_genshin_words.ts`

Ingests `genshin_words.json` (gitignored, downloaded via `udpate_json.sh`) into PostgreSQL.

## Behavior

- Runs in a single transaction
- Applies `schema_postgres.sql` first (idempotent)
- Upserts all five tables per glossary entry: `glossary`, `tag`, `glossary_tag`, `glossary_variant`, `glossary_pronunciation`
- `--prune` flag: deletes rows whose IDs are absent from the JSON

## Commands

```bash
pnpm import:words            # Upsert (safe, additive)
pnpm import:words:prune      # Upsert + delete rows missing from JSON
```

## Data Source

```bash
bash udpate_json.sh   # Downloads fresh genshin_words.json from dataset.genshin-dictionary.com
```
