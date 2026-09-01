-- 表结构清理：移除冗余/废弃结构（幂等，可安全重跑）
-- 1) posts.headings_json：仅写入、从不读取（渲染时由 renderMarkdown 实时重算），属冗余存储
-- 2) 旧 schema 废弃表（e84bdbd 重写迁移前存在）：post_categories / post_tags /
--    api_rate_limits / admin_login_attempts，已被 post_taxonomy / rate_limits 取代。
--    本地 dev 由 cf-dev-shim 自动 DROP，但生产库无对应迁移，此处补清理保证两端一致。

ALTER TABLE posts DROP COLUMN headings_json;

DROP TABLE IF EXISTS post_categories;
DROP TABLE IF EXISTS post_tags;
DROP TABLE IF EXISTS api_rate_limits;
DROP TABLE IF EXISTS admin_login_attempts;
