CREATE TABLE IF NOT EXISTS auth_rate_limits (
  identity_hash TEXT PRIMARY KEY,
  attempts INTEGER NOT NULL,
  window_started INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_rate_limits_expiry
  ON auth_rate_limits(expires_at);
