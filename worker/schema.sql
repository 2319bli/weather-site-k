CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO state(key, value) VALUES
  ('weather', '{"observed":{"cet":[],"ewp":[]},"forecast":{}}');
INSERT OR IGNORE INTO state(key, value) VALUES
  ('extremes-hei', '{}'), ('extremes-fei', '{}');
INSERT OR IGNORE INTO state(key, value) VALUES
  ('sunshine-sunuk', '[]'), ('sunshine-suneng', '[]'),
  ('sunshine-suneaw', '[]'), ('sunshine-sunmid', '[]');
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS login_limits (
  key TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
