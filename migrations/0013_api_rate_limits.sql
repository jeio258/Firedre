CREATE TABLE IF NOT EXISTS api_rate_limits (
  key TEXT PRIMARY KEY,
  window_started_at INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON api_rate_limits(window_started_at);
