-- 站点链接管理扩展：
-- 1) site_links 增加 kind 字段（link=普通跳转链接；qr=二维码图片，用于打赏收款码）
-- 2) 纳入打赏方式（location=sponsor）
-- 3) seed 旧硬编码外链（导航栏/footer/资料卡共 9 条）+ 打赏方式 4 条，作为开箱初始数据
ALTER TABLE site_links ADD COLUMN kind TEXT NOT NULL DEFAULT 'link';

-- 导航栏「链接」下拉外链（location=navbar，沿用原 navBarConfig 硬编码）
INSERT INTO site_links (name, url, icon, location, kind, sort_order, enabled, updated_at) VALUES
  ('GitHub',      'https://github.com/jeio258/Firedre',  'fa7-brands:github',        'navbar',  'link', 0, 1, datetime('now')),
  ('Gitee',       'https://gitee.com/CuteLeaf/Firefly',    'fa7-brands:gitee',         'navbar',  'link', 1, 1, datetime('now')),
  ('QQ交流群',    'https://qm.qq.com/q/ZGsFa8qX2G',       'fa7-brands:qq',            'navbar',  'link', 2, 1, datetime('now')),
  ('Firefly文档', 'https://docs-firefly.cuteleaf.cn',      'material-symbols:docs',    'navbar',  'link', 3, 1, datetime('now'));

-- 页脚 Powered by 外链（location=footer：上游 Firefly + 本项目 Firedre）
INSERT INTO site_links (name, url, icon, location, kind, sort_order, enabled, updated_at) VALUES
  ('Firefly', 'https://github.com/CuteLeaf/Firefly', '', 'footer', 'link', 0, 1, datetime('now')),
  ('Firedre', 'https://github.com/jeio258/Firedre', '', 'footer', 'link', 1, 1, datetime('now'));

-- 侧栏资料卡社交链接（location=profile，沿用原 profileConfig.links，含 mailto 与相对路径 RSS）
INSERT INTO site_links (name, url, icon, location, kind, sort_order, enabled, updated_at) VALUES
  ('qq',    'https://qm.qq.com/q/ZGsFa8qX2G', 'fa7-brands:qq',        'profile', 'link', 0, 1, datetime('now')),
  ('GitHub','https://github.com/jeio258',    'fa7-brands:github',    'profile', 'link', 1, 1, datetime('now')),
  ('Email', 'mailto:xiaye@msn.com',           'fa7-solid:envelope',   'profile', 'link', 2, 1, datetime('now')),
  ('RSS',   '/rss/',                          'fa7-solid:rss',        'profile', 'link', 3, 1, datetime('now'));

-- 打赏方式（location=sponsor，沿用原 sponsorConfig.methods：二维码=qr，跳转=link）
INSERT INTO site_links (name, url, icon, location, kind, sort_order, enabled, updated_at) VALUES
  ('支付宝', '/assets/images/sponsor/alipay.png', 'fa7-brands:alipay', 'sponsor', 'qr',  0, 1, datetime('now')),
  ('微信',   '/assets/images/sponsor/wechat.png', 'fa7-brands:weixin', 'sponsor', 'qr',  1, 1, datetime('now')),
  ('ko-fi',  'https://ko-fi.com/cuteleaf',        'simple-icons:kofi',  'sponsor', 'link', 2, 1, datetime('now')),
  ('爱发电', 'https://ifdian.net/a/cuteleaf',     'simple-icons:afdian','sponsor', 'link', 3, 1, datetime('now'));

CREATE INDEX IF NOT EXISTS idx_site_links_location ON site_links (location, enabled, sort_order, id);
