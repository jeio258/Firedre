-- C3: 清除 site_links 上游残留（gitee/Firefly文档/上游Firefly/ko-fi/爱发电 5 条，均指向 CuteLeaf 上游作者）
-- 依据生产实测（2026-10-02）：按 URL 内容识别，非硬编码 id（生产 id 与迁移种子不同）

DELETE FROM site_links
WHERE url IN (
	'https://gitee.com/CuteLeaf/Firefly',
	'https://docs-firefly.cuteleaf.cn',
	'https://github.com/CuteLeaf/Firefly',
	'https://ko-fi.com/cuteleaf',
	'https://ifdian.net/a/cuteleaf'
);

-- 回滚（如需恢复上游链接）：
-- INSERT INTO site_links (name, url, icon, kind, location, sort_order, enabled, updated_at) VALUES
-- ('Gitee','https://gitee.com/CuteLeaf/Firefly','fa7-brands:gitee','link','navbar',1,1,datetime('now')),
-- ('Firefly文档','https://docs-firefly.cuteleaf.cn','material-symbols:docs','link','navbar',3,1,datetime('now')),
-- ('Firefly','https://github.com/CuteLeaf/Firefly','','link','footer',0,1,datetime('now')),
-- ('ko-fi','https://ko-fi.com/cuteleaf','','link','sponsor',2,1,datetime('now')),
-- ('爱发电','https://ifdian.net/a/cuteleaf','','link','sponsor',3,1,datetime('now'));
