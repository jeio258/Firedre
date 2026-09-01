-- 站点链接管理（不含友链）：导航栏外链 / footer 外链 / 资料卡社交链接，统一后台管理
CREATE TABLE IF NOT EXISTS site_links (
	id INTEGER PRIMARY KEY AUTOINCREMENT,
	name TEXT NOT NULL,
	url TEXT NOT NULL,
	icon TEXT NOT NULL DEFAULT '',
	location TEXT NOT NULL DEFAULT 'navbar',
	sort_order INTEGER NOT NULL DEFAULT 0,
	enabled INTEGER NOT NULL DEFAULT 1,
	updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_site_links_location ON site_links (location, enabled, sort_order, id);
