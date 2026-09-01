-- 友链 + 相册密码
CREATE TABLE IF NOT EXISTS friends (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  imgurl TEXT NOT NULL,
  desc TEXT NOT NULL DEFAULT '',
  siteurl TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '',
  weight INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_friends_enabled ON friends(enabled, weight DESC);

-- 初始友链（静态配置迁移）
INSERT INTO friends (title, imgurl, desc, siteurl, tags, weight, enabled)
VALUES
  ('夏夜流萤', 'https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f6a1fd2f882f8f338402dc37e4190?s=640', '飞萤之火自无梦的长夜亮起，绽放在终竟的明天。', 'https://blog.cuteleaf.cn', 'Blog', 10, 1),
  ('Firefly Docs', 'https://docs-firefly.cuteleaf.cn/logo.png', 'Firefly主题模板文档', 'https://docs-firefly.cuteleaf.cn', 'Docs', 9, 1),
  ('Astro', 'https://avatars.githubusercontent.com/u/44914786?v=4&s=640', 'The web framework for content-driven websites. ⭐️ Star to support our work!', 'https://github.com/withastro/astro', 'Framework', 8, 1);

-- 相册访问密码（动态博客方式存 D1，密码明文供 SSR 加密与解锁校验）
CREATE TABLE IF NOT EXISTS album_passwords (
  album_slug TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
