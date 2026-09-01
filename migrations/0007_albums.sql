-- 相册 D1 化（完全动态化）
-- 设计：相册元数据从 R2 gallery/{slug}/index.md 迁到 D1。
--   albums       相册主表：每相册一行，存元数据 + 正文。
--   album_photos 照片表：每张照片一行，支持拖拽排序（sort_order）。
-- 现有 D1 表不变：
--   album_passwords（相册密码）继续作为锁门判定的权威来源。
--   album_webdav（WebDAV 源配置）继续使用。
CREATE TABLE IF NOT EXISTS albums (
  slug          TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '',
  desc          TEXT,
  date          TEXT,
  location      TEXT,
  tags          TEXT,          -- JSON 字符串数组
  cover         TEXT,
  encrypted     INTEGER NOT NULL DEFAULT 0,  -- 0/1，与 album_passwords 存在与否收敛
  password_hint TEXT,
  source        TEXT NOT NULL DEFAULT 'local',  -- local / webdav
  content       TEXT NOT NULL DEFAULT '',       -- 相册正文（原 index.md 正文）
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS album_photos (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  album_slug  TEXT NOT NULL,
  url         TEXT NOT NULL,
  type        TEXT,          -- image / video
  poster      TEXT,          -- 视频封面
  date        TEXT,          -- 拍摄/上传时间
  sort_order  INTEGER NOT NULL DEFAULT 0,  -- 拖拽排序序号
  FOREIGN KEY (album_slug) REFERENCES albums(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_album_photos_album_slug
  ON album_photos (album_slug);
