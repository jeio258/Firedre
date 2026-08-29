CREATE TABLE IF NOT EXISTS post_categories (
  post_slug TEXT NOT NULL,
  category_path TEXT NOT NULL,
  PRIMARY KEY (post_slug, category_path),
  FOREIGN KEY (post_slug) REFERENCES posts(slug) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS post_tags (
  post_slug TEXT NOT NULL,
  tag TEXT NOT NULL,
  PRIMARY KEY (post_slug, tag),
  FOREIGN KEY (post_slug) REFERENCES posts(slug) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_categories_path ON post_categories(category_path);
CREATE INDEX IF NOT EXISTS idx_post_tags_tag ON post_tags(tag);
CREATE INDEX IF NOT EXISTS idx_posts_published_date ON posts(published, date DESC);
