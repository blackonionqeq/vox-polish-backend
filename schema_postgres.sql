-- PostgreSQL schema for importing genshin_words.json
-- Apply once before running the importer script.

CREATE TABLE IF NOT EXISTS glossary (
  id TEXT PRIMARY KEY,
  en TEXT,
  ja TEXT,
  zh_cn TEXT,
  zh_tw TEXT,
  pronunciation_ja TEXT,
  notes TEXT,
  notes_en TEXT,
  notes_zh TEXT,
  notes_zh_tw TEXT,
  created_at DATE,
  updated_at DATE,
  source_updated_at DATE,
  raw JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS tag (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS glossary_tag (
  glossary_id TEXT NOT NULL REFERENCES glossary(id) ON DELETE CASCADE,
  tag_id BIGINT NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (glossary_id, tag_id)
);

CREATE TABLE IF NOT EXISTS glossary_variant (
  glossary_id TEXT NOT NULL REFERENCES glossary(id) ON DELETE CASCADE,
  lang_code TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (glossary_id, lang_code, value)
);

CREATE TABLE IF NOT EXISTS glossary_pronunciation (
  glossary_id TEXT NOT NULL REFERENCES glossary(id) ON DELETE CASCADE,
  system TEXT NOT NULL, -- e.g. pinyin / zhuyin
  char TEXT NOT NULL,
  pron TEXT NOT NULL,
  PRIMARY KEY (glossary_id, system, char, pron)
);

-- Query acceleration for "selected tags -> glossary entries"
CREATE INDEX IF NOT EXISTS idx_glossary_tag_tag_id_glossary_id
ON glossary_tag (tag_id, glossary_id);

-- Often helpful when listing all tags for one glossary item.
CREATE INDEX IF NOT EXISTS idx_glossary_tag_glossary_id_tag_id
ON glossary_tag (glossary_id, tag_id);

CREATE INDEX IF NOT EXISTS idx_glossary_variant_lang_value
ON glossary_variant (lang_code, value);

CREATE INDEX IF NOT EXISTS idx_glossary_pron_system_char
ON glossary_pronunciation (system, char);

-- Often helpful when listing all ja entries.
CREATE INDEX IF NOT EXISTS idx_glossary_ja
ON glossary (ja);