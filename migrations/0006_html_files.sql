CREATE TABLE IF NOT EXISTS html_files (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  r2_key TEXT NOT NULL,
  public_path TEXT NOT NULL UNIQUE,
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_html_files_updated ON html_files(updated_at DESC);
