-- Firedre D1 基线（由 0001~0011 合并而来，等价于旧链最终态）
-- 幂等：CREATE TABLE/INDEX IF NOT EXISTS；种子 INSERT OR IGNORE（显式 id 以便冲突忽略）
-- 不含数据迁移语句：旧库废弃结构与冗余列一律不再创建

-- ========== 文章（正文存 R2，r2_key 指向） ==========
CREATE TABLE IF NOT EXISTS posts (
  slug TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  excerpt TEXT,
  description TEXT,
  date TEXT NOT NULL,
  updated TEXT,
  categories TEXT,
  tags TEXT,
  cover TEXT,
  published INTEGER NOT NULL DEFAULT 1,
  password TEXT NOT NULL DEFAULT '',
  fm_json TEXT NOT NULL DEFAULT '{}',
  words INTEGER NOT NULL DEFAULT 0,
  minutes INTEGER NOT NULL DEFAULT 0,
  r2_key TEXT NOT NULL,
  pin_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_posts_date ON posts(date DESC);
CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
CREATE INDEX IF NOT EXISTS idx_posts_pin_order ON posts(pin_order DESC, date DESC);

CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  slug UNINDEXED,
  title,
  excerpt,
  content,
  tokenize = 'unicode61'
);

-- 分类（type='category'）与标签（type='tag'）统一表
CREATE TABLE IF NOT EXISTS post_taxonomy (
  post_slug TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('category', 'tag')),
  value TEXT NOT NULL,
  PRIMARY KEY (post_slug, type, value),
  FOREIGN KEY (post_slug) REFERENCES posts(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_taxonomy_type_value ON post_taxonomy(type, value);

-- ========== 社交内容 ==========
CREATE TABLE IF NOT EXISTS notice_board (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  title TEXT NOT NULL DEFAULT '公告栏',
  sections_json TEXT NOT NULL DEFAULT '[]',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS dynamics (
  id TEXT PRIMARY KEY,
  content TEXT NOT NULL,
  images TEXT NOT NULL DEFAULT '[]',
  published INTEGER NOT NULL,
  pinned INTEGER NOT NULL DEFAULT 0,
  location TEXT NOT NULL DEFAULT '',
  search_text TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_dynamics_published ON dynamics(published DESC);
CREATE INDEX IF NOT EXISTS idx_dynamics_pinned ON dynamics(pinned DESC, published DESC);

-- ========== 系统 ==========
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- kind 区分语义：'window'（通用限流）/ 'login'（登录失败锁定）
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('window', 'login')),
  window_started_at INTEGER,
  count INTEGER NOT NULL DEFAULT 0,
  locked_until TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_window ON rate_limits(window_started_at);

-- ========== 友链 ==========
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

INSERT OR IGNORE INTO friends (id, title, imgurl, desc, siteurl, tags, weight, enabled)
VALUES
  (1, '夏夜流萤', 'https://weavatar.com/avatar/d252655d40d6874417a720bad0a6c5f77f8f6a1fd2f882f8f338402dc37e4190?s=640', '飞萤之火自无梦的长夜亮起，绽放在终竟的明天。', 'https://blog.cuteleaf.cn', 'Blog', 10, 1),
  (2, 'Firefly Docs', 'https://docs-firefly.cuteleaf.cn/logo.png', 'Firefly主题模板文档', 'https://docs-firefly.cuteleaf.cn', 'Docs', 9, 1),
  (3, 'Astro', 'https://avatars.githubusercontent.com/u/44914786?v=4&s=640', 'The web framework for content-driven websites. ⭐️ Star to support our work!', 'https://github.com/withastro/astro', 'Framework', 8, 1);

-- ========== 相册 ==========
-- 相册访问密码（明文存 D1，供 SSR 加密与解锁校验）
CREATE TABLE IF NOT EXISTS album_passwords (
  album_slug TEXT PRIMARY KEY,
  password TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- WebDAV 源配置（登录密码恒走环境变量，不落库）
CREATE TABLE IF NOT EXISTS album_webdav (
  album_slug TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  username TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS albums (
  slug          TEXT PRIMARY KEY,
  title         TEXT NOT NULL DEFAULT '',
  desc          TEXT,
  date          TEXT,
  location      TEXT,
  tags          TEXT,          -- JSON 字符串数组
  cover         TEXT,
  encrypted     INTEGER NOT NULL DEFAULT 0,
  password_hint TEXT,
  source        TEXT NOT NULL DEFAULT 'local',  -- local / webdav
  content       TEXT NOT NULL DEFAULT '',
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
  sort_order  INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (album_slug) REFERENCES albums(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_album_photos_album_slug
  ON album_photos (album_slug);

-- ========== 后台管理员 ==========
CREATE TABLE IF NOT EXISTS admin_users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- 单管理员模型：并发下杜绝多管理员
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_singleton ON admin_users((1));

-- ========== 站点外链（导航栏 / footer / 资料卡 / 打赏） ==========
CREATE TABLE IF NOT EXISTS site_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '',
  kind TEXT NOT NULL DEFAULT 'link',  -- link=普通跳转；qr=二维码图片
  location TEXT NOT NULL DEFAULT 'navbar',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_site_links_location
  ON site_links (location, enabled, sort_order, id);

INSERT OR IGNORE INTO site_links (id, name, url, icon, location, kind, sort_order, enabled)
VALUES
  (1,  'GitHub',      'https://github.com/jeio258/Firedre',  'fa7-brands:github',     'navbar',  'link', 0, 1),
  (2,  'Gitee',       'https://gitee.com/CuteLeaf/Firefly',   'fa7-brands:gitee',      'navbar',  'link', 1, 1),
  (3,  'QQ交流群',    'https://qm.qq.com/q/ZGsFa8qX2G',       'fa7-brands:qq',         'navbar',  'link', 2, 1),
  (4,  'Firefly文档', 'https://docs-firefly.cuteleaf.cn',     'material-symbols:docs', 'navbar',  'link', 3, 1),
  (5,  'Firefly',     'https://github.com/CuteLeaf/Firefly',  '',                      'footer',  'link', 0, 1),
  (6,  'Firedre',     'https://github.com/jeio258/Firedre',   '',                      'footer',  'link', 1, 1),
  (7,  'qq',          'https://qm.qq.com/q/ZGsFa8qX2G',       'fa7-brands:qq',         'profile', 'link', 0, 1),
  (8,  'GitHub',      'https://github.com/jeio258',           'fa7-brands:github',     'profile', 'link', 1, 1),
  (9,  'Email',       'mailto:xiaye@msn.com',                 'fa7-solid:envelope',    'profile', 'link', 2, 1),
  (10, 'RSS',         '/rss/',                                'fa7-solid:rss',         'profile', 'link', 3, 1),
  (11, '支付宝',      '/assets/images/sponsor/alipay.png',    'fa7-brands:alipay',     'sponsor', 'qr',   0, 1),
  (12, '微信',        '/assets/images/sponsor/wechat.png',    'fa7-brands:weixin',     'sponsor', 'qr',   1, 1),
  (13, 'ko-fi',       'https://ko-fi.com/cuteleaf',           'simple-icons:kofi',     'sponsor', 'link', 2, 1),
  (14, '爱发电',      'https://ifdian.net/a/cuteleaf',        'simple-icons:afdian',   'sponsor', 'link', 3, 1);
