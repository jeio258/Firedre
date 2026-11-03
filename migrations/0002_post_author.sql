-- 文章归属（作者隔离）：持 post:create 的用户只能见/改/删自己的文章，站长不受限。
-- ALTER 无 IF NOT EXISTS，重复执行报 duplicate column：生产由 wrangler d1 migrations
-- 记账单次执行；seed.ensureSchema 探测到列缺失时才应用本文件（dev/tests 走该路径）。
ALTER TABLE posts ADD COLUMN author_id TEXT;

-- 回填：历史文章归属站长（首个 role='admin' 用户）；应用时若无 admin 用户则保持 NULL，
-- NULL 语义视同站长所有（非站长作者不可见不可改）
UPDATE posts SET author_id = (
  SELECT id FROM users WHERE role = 'admin' ORDER BY created_at LIMIT 1
) WHERE author_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
