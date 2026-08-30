-- 相册访问密码存储（动态博客方式：像 dynamics 一样存 D1，而非写进相册 frontmatter）
-- 相册 index.md 只保留 encrypted: true 标记；密码明文存此表（供 SSR EncryptContent 加密与解锁校验）
CREATE TABLE IF NOT EXISTS album_passwords (
  album_slug TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
