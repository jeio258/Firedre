CREATE TABLE IF NOT EXISTS notice_board (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL DEFAULT '公告栏',
  sections_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
