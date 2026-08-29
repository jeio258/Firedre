ALTER TABLE posts ADD COLUMN pin_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_posts_pin_order ON posts(pin_order DESC, date DESC);
