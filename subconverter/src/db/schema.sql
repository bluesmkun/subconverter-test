-- Subconverter D1 Database Schema

-- Subscriptions (airport/remote subscriptions)
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  type TEXT NOT NULL DEFAULT 'remote',  -- 'remote' | 'manual'
  user_agent TEXT DEFAULT 'subconverter/1.0',
  last_synced_at TEXT,
  sync_interval INTEGER DEFAULT 3600,
  node_count INTEGER DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Nodes (individual proxy nodes)
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  subscription_id TEXT,
  name TEXT NOT NULL,
  protocol TEXT NOT NULL,
  address TEXT NOT NULL,
  port INTEGER NOT NULL,
  config TEXT NOT NULL DEFAULT '{}',
  -- Cached common fields
  password TEXT DEFAULT '',
  uuid TEXT DEFAULT '',
  sni TEXT DEFAULT '',
  host TEXT DEFAULT '',
  path TEXT DEFAULT '',
  network TEXT DEFAULT 'tcp',
  tls INTEGER NOT NULL DEFAULT 0,
  fingerprint TEXT DEFAULT '',
  alpn TEXT DEFAULT '',
  region TEXT DEFAULT '',
  group_name TEXT DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  latency INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Profiles (subscription groupings)
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  default_client TEXT NOT NULL DEFAULT 'clash',
  sort_order INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Profile <-> Subscription mappings
CREATE TABLE IF NOT EXISTS profile_subscriptions (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  subscription_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (subscription_id) REFERENCES subscriptions(id) ON DELETE CASCADE
);

-- Profile <-> Individual Node mappings (for manual nodes)
CREATE TABLE IF NOT EXISTS profile_nodes (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  node_id TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE,
  FOREIGN KEY (node_id) REFERENCES nodes(id) ON DELETE CASCADE
);

-- Operator chains attached to profiles
CREATE TABLE IF NOT EXISTS operator_chains (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  op_type TEXT NOT NULL,
  op_config TEXT NOT NULL DEFAULT '{}',
  enabled INTEGER NOT NULL DEFAULT 1,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (profile_id) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Template presets (global templates)
CREATE TABLE IF NOT EXISTS template_presets (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  client_type TEXT NOT NULL,
  description TEXT DEFAULT '',
  config TEXT NOT NULL DEFAULT '{}',
  is_builtin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_nodes_subscription ON nodes(subscription_id);
CREATE INDEX IF NOT EXISTS idx_nodes_protocol ON nodes(protocol);
CREATE INDEX IF NOT EXISTS idx_nodes_region ON nodes(region);
CREATE INDEX IF NOT EXISTS idx_profile_subs_profile ON profile_subscriptions(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_subs_sub ON profile_subscriptions(subscription_id);
CREATE INDEX IF NOT EXISTS idx_profile_nodes_profile ON profile_nodes(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_nodes_node ON profile_nodes(node_id);
CREATE INDEX IF NOT EXISTS idx_operator_chains_profile ON operator_chains(profile_id);
CREATE INDEX IF NOT EXISTS idx_template_presets_client ON template_presets(client_type);
