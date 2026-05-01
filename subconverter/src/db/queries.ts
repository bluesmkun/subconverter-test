import type { D1Database } from '@cloudflare/workers-types';

export interface Subscription {
  id: string;
  name: string;
  url: string;
  type: string;
  user_agent: string;
  last_synced_at: string | null;
  sync_interval: number;
  node_count: number;
  enabled: number;
  sort_order: number;
  notes: string;
  created_at: string;
  updated_at: string;
}

export interface Node {
  id: string;
  subscription_id: string | null;
  name: string;
  protocol: string;
  address: string;
  port: number;
  config: string;
  password: string;
  uuid: string;
  sni: string;
  host: string;
  path: string;
  network: string;
  tls: number;
  fingerprint: string;
  alpn: string;
  region: string;
  group_name: string;
  sort_order: number;
  enabled: number;
  latency: number;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  name: string;
  slug: string;
  description: string;
  default_client: string;
  sort_order: number;
  enabled: number;
  created_at: string;
  updated_at: string;
}

export interface OperatorChain {
  id: string;
  profile_id: string;
  op_type: string;
  op_config: string;
  enabled: number;
  sort_order: number;
}

export interface TemplatePreset {
  id: string;
  name: string;
  client_type: string;
  description: string;
  config: string;
  is_builtin: number;
  created_at: string;
  updated_at: string;
}

export function queryOne<T>(db: D1Database, sql: string, ...params: any[]): Promise<T | null> {
  return db.prepare(sql).bind(...params).first<T>();
}

export function queryAll<T>(db: D1Database, sql: string, ...params: any[]): Promise<{ results: T[] }> {
  return db.prepare(sql).bind(...params).all<T>();
}

export function execute(db: D1Database, sql: string, ...params: any[]): Promise<{ success: boolean }> {
  return db.prepare(sql).bind(...params).run();
}
