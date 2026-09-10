-- 强制单管理员模型：先去重保留最早一行，再建立单例唯一索引（并发下杜绝多管理员）
DELETE FROM admin_users WHERE id NOT IN (SELECT MIN(id) FROM admin_users);
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_users_singleton ON admin_users((1));
