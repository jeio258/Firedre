-- 后台管理员用户（凭据迁移到 D1）
-- 设计：ADMIN_USERNAME/ADMIN_PASSWORD 原存 Cloudflare Secrets；本表成为登录凭据的唯一权威。
-- 平滑迁移：D1 表为空时，首次用旧 Secrets 凭据登录成功 → 自动落库为 admin 用户；之后以 D1 为准。
-- SESSION_SECRET（会话签名密钥）仍走 Secrets，不落库（安全硬性要求）。
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);
