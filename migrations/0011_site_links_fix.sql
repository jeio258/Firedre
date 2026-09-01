-- 站点链接数据修正：
-- 1) 页脚 Powered by 去重：保留 1 个上游 Firefly，补充本项目 Firedre
-- 2) 导航栏/资料卡 GitHub 统一指向 jeio258（页脚保留上游）

-- 页脚：删除重复的 Firefly（保留最小 id）
DELETE FROM site_links
WHERE location = 'footer' AND name = 'Firefly'
  AND id NOT IN (SELECT MIN(id) FROM site_links WHERE location = 'footer' AND name = 'Firefly');

-- 页脚：补充本项目链接（不存在则插入）
INSERT INTO site_links (name, url, icon, location, kind, sort_order, enabled, updated_at)
SELECT 'Firedre', 'https://github.com/jeio258/Firedre', '', 'footer', 'link', 1, 1, datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM site_links WHERE location = 'footer' AND name = 'Firedre');

-- 导航栏：GitHub 指向我的项目
UPDATE site_links SET url = 'https://github.com/jeio258/Firedre'
WHERE location = 'navbar' AND name = 'GitHub' AND url LIKE '%CuteLeaf%';

-- 导航栏：GitHub 去重（保留最小 id）
DELETE FROM site_links
WHERE location = 'navbar' AND name = 'GitHub'
  AND id NOT IN (SELECT MIN(id) FROM site_links WHERE location = 'navbar' AND name = 'GitHub');

-- 资料卡：GitHub 指向我的账号
UPDATE site_links SET url = 'https://github.com/jeio258'
WHERE location = 'profile' AND name = 'GitHub' AND url LIKE '%CuteLeaf%';
