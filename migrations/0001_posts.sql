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
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);

CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  slug UNINDEXED,
  title,
  excerpt,
  content,
  tokenize = 'unicode61'
);
