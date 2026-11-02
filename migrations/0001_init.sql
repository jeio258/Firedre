-- Firedre D1 基线（唯一迁移文件：由旧链 0001~0011、查询索引补丁、FTS trigram 重建全部合并而来）
-- 幂等：CREATE TABLE/INDEX IF NOT EXISTS；种子 INSERT OR IGNORE（显式 id 以便冲突忽略）
-- 不含数据迁移语句：旧库废弃结构与冗余列一律不再创建
-- 规则：后续任何表结构变更直接改本文件（幂等可重复执行），不再新增迁移文件；
--       线上已存在的库用 wrangler d1 execute --file 本文件 手动重放收敛

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
-- 列表主查询：WHERE published=1 ORDER BY pin_order DESC, date DESC —— 复合索引让过滤+排序
-- 走同一索引，免去「单列过滤后回表排序」；与上面两个单列索引并存（各自仍有用途）
CREATE INDEX IF NOT EXISTS idx_posts_published_pin_order
  ON posts(published, pin_order DESC, date DESC);
-- 全量文章元数据（allPostMeta）：WHERE published=1 ORDER BY date DESC
CREATE INDEX IF NOT EXISTS idx_posts_published_date
  ON posts (published, date DESC);

-- trigram 分词：中文按 3 字符滑窗索引，任意位置子串可命中；
-- 2 字查询 MATCH 命中为 0 是 FTS5 硬限制，由 searchPosts 的 LIKE 通道兜底
CREATE VIRTUAL TABLE IF NOT EXISTS posts_fts USING fts5(
  slug UNINDEXED,
  title,
  excerpt,
  content,
  tokenize = 'trigram'
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
-- 相册访问密码（AES-GCM 密文存 D1，供 SSR 解密与解锁校验；明文不落库）
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
-- 相册照片加载（loadPhotos）：WHERE album_slug=? ORDER BY sort_order ASC, id ASC
CREATE INDEX IF NOT EXISTS idx_album_photos_album_sort
  ON album_photos (album_slug, sort_order, id);

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

-- ========== 用户系统 ==========
-- users 为全站唯一身份表：前台用户与管理员共用，role='admin' 即可进后台。
-- 密码指纹（sha256(password).slice(0,16)）内嵌会话 token，改密即吊销旧会话。
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  email_verified INTEGER NOT NULL DEFAULT 0,
  name TEXT NOT NULL,
  password TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  bio TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'user',
  banned INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS oauth_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('github','google')),
  provider_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (provider, provider_user_id)
);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);

-- 验证/重置 token 只存 sha256，明文仅出现在邮件链接
CREATE TABLE IF NOT EXISTS email_verifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  purpose TEXT NOT NULL CHECK (purpose IN ('signup','reset')),
  expires_at TEXT NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_email_verifications_user
  ON email_verifications(user_id, purpose);

-- 别名邮箱：与 users.email 同权参与登录解析，全表唯一
CREATE TABLE IF NOT EXISTS user_emails (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_user_emails_user ON user_emails(user_id);

CREATE TABLE IF NOT EXISTS user_permissions (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  perm TEXT NOT NULL,
  granted_by TEXT NOT NULL DEFAULT '',
  granted_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, perm)
);
CREATE INDEX IF NOT EXISTS idx_user_permissions_perm ON user_permissions(perm);

CREATE TABLE IF NOT EXISTS permission_requests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  perm TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','denied')),
  note TEXT NOT NULL DEFAULT '',
  requested_at TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by TEXT,
  reviewed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_permission_requests_user
  ON permission_requests(user_id, status);
CREATE INDEX IF NOT EXISTS idx_permission_requests_status
  ON permission_requests(status, requested_at DESC);

-- target 不设 FK：可为文章 slug、'guestbook'、'dynamic:<id>' 等伪目标
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  target TEXT NOT NULL,
  parent_id TEXT REFERENCES comments(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  guest_name TEXT NOT NULL DEFAULT '',
  guest_email TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','approved','spam','deleted')),
  ip TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_comments_target
  ON comments(target, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_comments_status
  ON comments(status, created_at DESC);

CREATE TABLE IF NOT EXISTS post_likes (
  post_slug TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (post_slug, user_id)
);
CREATE INDEX IF NOT EXISTS idx_post_likes_slug ON post_likes(post_slug);

-- 发信审计：sendMail 尽力写入，表不可用时静默跳过
CREATE TABLE IF NOT EXISTS mail_log (
  id TEXT PRIMARY KEY,
  to_email TEXT,
  subject TEXT,
  status TEXT,
  detail TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
