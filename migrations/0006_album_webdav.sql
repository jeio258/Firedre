-- 相册 WebDAV 源配置（存 D1，动态博客方式）
-- 设计：WebDAV 相册的 url/username 存此表；index.md frontmatter 只保留 source: webdav 标记。
-- WebDAV 登录密码（WEBDAV_PASSWORD）恒走环境变量，不落库/文件。
CREATE TABLE IF NOT EXISTS album_webdav (
  album_slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  username TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
