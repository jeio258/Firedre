-- 系统：站点设置 + 统一限流表
-- rate_limits 用 kind 区分语义：'window'（通用限流）/ 'login'（登录失败锁定）
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('window', 'login')),
  window_started_at INTEGER,
  count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_started_at);
