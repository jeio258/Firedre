CREATE TABLE IF NOT EXISTS admin_login_attempts (
  ip TEXT PRIMARY KEY,
  fail_count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT
);
