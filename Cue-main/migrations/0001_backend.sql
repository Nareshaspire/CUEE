PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  name TEXT NOT NULL,
  account_type TEXT NOT NULL DEFAULT 'baker',
  password_salt TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  csrf_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user_id ON sessions(user_id);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  task_definitions TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS production_runs (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL,
  product_id TEXT NOT NULL REFERENCES products(id),
  run_type TEXT NOT NULL CHECK (run_type IN ('customer-order', 'planned-production')),
  quantity INTEGER,
  selected_process TEXT,
  status TEXT NOT NULL,
  version INTEGER NOT NULL DEFAULT 1,
  tasks TEXT NOT NULL,
  history TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(owner_id, run_id)
);
CREATE INDEX IF NOT EXISTS production_runs_owner_updated
  ON production_runs(owner_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS pending_actions (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  run_id TEXT NOT NULL REFERENCES production_runs(id) ON DELETE CASCADE,
  task_key TEXT NOT NULL,
  expected_state TEXT NOT NULL,
  proposed_state TEXT NOT NULL,
  action_type TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL CHECK (status IN ('PENDING', 'CONFIRMED', 'CANCELLED', 'STALE')),
  snapshot_version INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS pending_actions_owner_status
  ON pending_actions(owner_id, status, created_at);

CREATE TABLE IF NOT EXISTS oauth_codes (
  code_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL,
  redirect_uri TEXT NOT NULL,
  code_challenge TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE TABLE IF NOT EXISTS alexa_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_type TEXT NOT NULL CHECK (token_type IN ('access', 'refresh')),
  family_id TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS alexa_tokens_family ON alexa_tokens(family_id);

INSERT OR IGNORE INTO products (id, name, slug, description, task_definitions) VALUES
('product-pistachio', 'Chewy Pistachio Crunchies', 'chewy-pistachio-crunchies', 'Pistachio and kataifi treats', '[{"key":"prepare-ingredients","name":"Prepare ingredients","sequence":1,"category":"preparation","prerequisites":[]},{"key":"prepare-main","name":"Prepare the main component","sequence":2,"category":"preparation","prerequisites":[{"taskKey":"prepare-ingredients"}]},{"key":"cook-main","name":"Cook or bake the main component","sequence":3,"category":"active","prerequisites":[{"taskKey":"prepare-main"}]},{"key":"prepare-packaging","name":"Prepare packaging","sequence":4,"category":"packing","prerequisites":[],"allowsParallel":true},{"key":"cool-main","name":"Cool the main component","sequence":5,"category":"waiting","prerequisites":[{"taskKey":"cook-main"}],"waitingReason":"cooling","expectedMinutes":45,"physicalCheckRequired":true},{"key":"inspect-main","name":"Inspect the finished component","sequence":6,"category":"inspection","prerequisites":[{"taskKey":"cool-main"}],"physicalCheckRequired":true},{"key":"finish-run","name":"Finish and pack order","sequence":7,"category":"finishing","prerequisites":[{"taskKey":"inspect-main"},{"taskKey":"prepare-packaging"}]}]'),
('product-cheesecake', 'Biscoff Cheesecake', 'no-bake-cheesecake-biscoff', 'Chilled no-bake cheesecake', '[{"key":"prepare-ingredients","name":"Prepare ingredients","sequence":1,"category":"preparation","prerequisites":[]},{"key":"prepare-main","name":"Prepare the main component","sequence":2,"category":"preparation","prerequisites":[{"taskKey":"prepare-ingredients"}]},{"key":"cook-main","name":"Prepare cheesecake filling","sequence":3,"category":"active","prerequisites":[{"taskKey":"prepare-main"}]},{"key":"prepare-packaging","name":"Prepare packaging","sequence":4,"category":"packing","prerequisites":[],"allowsParallel":true},{"key":"cool-main","name":"Chill cheesecake","sequence":5,"category":"waiting","prerequisites":[{"taskKey":"cook-main"}],"waitingReason":"chilling","expectedMinutes":45,"physicalCheckRequired":true},{"key":"inspect-main","name":"Inspect the finished component","sequence":6,"category":"inspection","prerequisites":[{"taskKey":"cool-main"}],"physicalCheckRequired":true},{"key":"finish-run","name":"Finish and pack order","sequence":7,"category":"finishing","prerequisites":[{"taskKey":"inspect-main"},{"taskKey":"prepare-packaging"}]}]'),
('product-cookies', 'Belgian Chocolate Chip Cookies', 'belgian-chocolate-chip-cookies', 'Small batch cookies', '[{"key":"prepare-ingredients","name":"Prepare ingredients","sequence":1,"category":"preparation","prerequisites":[]},{"key":"prepare-main","name":"Prepare the main component","sequence":2,"category":"preparation","prerequisites":[{"taskKey":"prepare-ingredients"}]},{"key":"cook-main","name":"Cook or bake the main component","sequence":3,"category":"active","prerequisites":[{"taskKey":"prepare-main"}]},{"key":"prepare-packaging","name":"Prepare packaging","sequence":4,"category":"packing","prerequisites":[],"allowsParallel":true},{"key":"cool-main","name":"Cool the main component","sequence":5,"category":"waiting","prerequisites":[{"taskKey":"cook-main"}],"waitingReason":"cooling","expectedMinutes":45,"physicalCheckRequired":true},{"key":"inspect-main","name":"Inspect the finished component","sequence":6,"category":"inspection","prerequisites":[{"taskKey":"cool-main"}],"physicalCheckRequired":true},{"key":"finish-run","name":"Finish and pack order","sequence":7,"category":"finishing","prerequisites":[{"taskKey":"inspect-main"},{"taskKey":"prepare-packaging"}]}]');
