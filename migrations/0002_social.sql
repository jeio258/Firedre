-- 社交内容：公告栏 + 动态
CREATE TABLE IF NOT EXISTS notice_board (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL DEFAULT '公告栏',
  sections_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dynamics (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dynamics_published ON dynamics(published DESC);
CREATE INDEX IF NOT EXISTS idx_dynamics_pinned ON dynamics(pinned DESC, published DESC);
