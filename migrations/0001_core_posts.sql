-- 核心：文章表 + 全文检索 + 分类/标签统一表
-- 文章正文存 R2（r2_key），D1 存元数据；分类与标签统一为 post_taxonomy 单表（type 区分）
CREATE TABLE IF NOT EXISTS posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT,
  description TEXT,
  date TEXT NOT NULL,
  updated TEXT,
  categories TEXT,
  tags TEXT,
  cover TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  password TEXT NOT NULL DEFAULT '',
  fm_json TEXT NOT NULL DEFAULT '{}',
  words INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0,
  headings_json TEXT NOT NULL DEFAULT '[]',
  r2_key TEXT NOT NULL,
  pin_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
CREATE INDEX IF NOT EXISTS idx_posts_pin_order ON posts(pin_order DESC, date DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  slug UNINDEXED,
  title,
  excerpt,
  content,
  tokenize = 'unicode61'
);

-- 分类（type='category'）与标签（type='tag'）统一表
CREATE TABLE IF NOT EXISTS post_taxonomy (
  post_slug TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('category', 'tag')),
  value TEXT NOT NULL,
  PRIMARY KEY (post_slug, type, value),
  FOREIGN KEY (post_slug) REFERENCES posts(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_taxonomy_type_value ON post_taxonomy(type, value);
