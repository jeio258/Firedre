-- 0002 查询索引：只补 0001 未覆盖的复合索引（幂等），不动表结构与数据
-- album_photos(album_slug, sort_order, id) ← server/gallery/d1.ts loadPhotos / getAlbumsFromD1Map 的 WHERE album_slug=? ORDER BY sort_order ASC, id ASC
-- posts(published, date DESC) ← server/posts/allPostMeta.ts 的 WHERE published=1 ORDER BY date DESC

CREATE INDEX IF NOT EXISTS idx_album_photos_album_sort
  ON album_photos (album_slug, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_posts_published_date
  ON posts (published, date DESC);
