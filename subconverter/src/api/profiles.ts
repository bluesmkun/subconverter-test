import type { Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { generateId, generateSlug, nowISO } from '../utils/uuid';
import { success, error } from '../utils/response';
import { queryAll, queryOne, execute } from '../db/queries';

function getDB(c: Context): D1Database {
  return (c.env as any).DB as D1Database;
}

// GET /api/profiles
export async function listProfiles(c: Context): Promise<Response> {
  const db = getDB(c);
  const { results } = await queryAll<any>(db, 'SELECT * FROM profiles ORDER BY sort_order ASC');
  
  // For each profile, get subscription and node counts
  for (const profile of results) {
    const subResult = await queryAll<any>(db,
      'SELECT subscription_id FROM profile_subscriptions WHERE profile_id = ?', profile.id
    );
    const nodeResult = await queryAll<any>(db,
      'SELECT node_id FROM profile_nodes WHERE profile_id = ?', profile.id
    );
    profile.subscription_count = subResult.results.length;
    profile.node_count = nodeResult.results.length;
  }
  
  return success(results);
}

// GET /api/profiles/:id
export async function getProfile(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  
  const profile = await queryOne<any>(db, 'SELECT * FROM profiles WHERE id = ?', id);
  if (!profile) return error('Profile not found', 404);
  
  // Get subscriptions
  const subResult = await queryAll<any>(db,
    `SELECT s.* FROM subscriptions s
     INNER JOIN profile_subscriptions ps ON s.id = ps.subscription_id
     WHERE ps.profile_id = ?
     ORDER BY ps.sort_order ASC`, id
  );
  
  // Get direct nodes
  const nodeResult = await queryAll<any>(db,
    `SELECT n.* FROM nodes n
     INNER JOIN profile_nodes pn ON n.id = pn.node_id
     WHERE pn.profile_id = ?
     ORDER BY pn.sort_order ASC`, id
  );
  
  // Get operator chains
  const chainResult = await queryAll<any>(db,
    'SELECT * FROM operator_chains WHERE profile_id = ? ORDER BY sort_order ASC', id
  );
  
  profile.subscriptions = subResult.results;
  profile.direct_nodes = nodeResult.results;
  profile.operator_chains = chainResult.results;
  
  return success(profile);
}

// POST /api/profiles
export async function createProfile(c: Context): Promise<Response> {
  const db = getDB(c);
  const body = await c.req.json();
  const id = generateId();
  const now = nowISO();
  const slug = body.slug || generateSlug(body.name || 'New Profile');
  
  // Check slug uniqueness
  const existing = await queryOne<any>(db, 'SELECT id FROM profiles WHERE slug = ?', slug);
  if (existing) return error('Profile slug already exists', 409);
  
  await execute(db,
    `INSERT INTO profiles (id, name, slug, description, default_client, sort_order, enabled, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id, body.name || 'New Profile', slug, body.description || '',
    body.default_client || 'clash', body.sort_order || 0,
    body.enabled !== undefined ? body.enabled : 1, now, now
  );
  
  const profile = await queryOne<any>(db, 'SELECT * FROM profiles WHERE id = ?', id);
  return success(profile, 'Profile created');
}

// PUT /api/profiles/:id
export async function updateProfile(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = nowISO();
  
  const existing = await queryOne<any>(db, 'SELECT * FROM profiles WHERE id = ?', id);
  if (!existing) return error('Profile not found', 404);
  
  await execute(db,
    `UPDATE profiles SET name=?, slug=?, description=?, default_client=?, sort_order=?, enabled=?, updated_at=? WHERE id=?`,
    body.name ?? existing.name,
    body.slug ?? existing.slug,
    body.description ?? existing.description,
    body.default_client ?? existing.default_client,
    body.sort_order ?? existing.sort_order,
    body.enabled !== undefined ? body.enabled : existing.enabled,
    now,
    id
  );
  
  const profile = await queryOne<any>(db, 'SELECT * FROM profiles WHERE id = ?', id);
  return success(profile, 'Profile updated');
}

// DELETE /api/profiles/:id
export async function deleteProfile(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  
  await execute(db, 'DELETE FROM profile_subscriptions WHERE profile_id = ?', id);
  await execute(db, 'DELETE FROM profile_nodes WHERE profile_id = ?', id);
  await execute(db, 'DELETE FROM operator_chains WHERE profile_id = ?', id);
  await execute(db, 'DELETE FROM profiles WHERE id = ?', id);
  
  return success(null, 'Profile deleted');
}

// POST /api/profiles/:id/subscriptions
export async function addProfileSubscription(c: Context): Promise<Response> {
  const db = getDB(c);
  const profileId = c.req.param('id');
  const body = await c.req.json();
  
  const profile = await queryOne<any>(db, 'SELECT id FROM profiles WHERE id = ?', profileId);
  if (!profile) return error('Profile not found', 404);
  
  const subs = Array.isArray(body.subscription_ids) ? body.subscription_ids : [body.subscription_id];
  const mapId = generateId();
  
  for (const subId of subs) {
    const sub = await queryOne<any>(db, 'SELECT id FROM subscriptions WHERE id = ?', subId);
    if (!sub) continue;
    
    // Check duplicate
    const existing = await queryOne<any>(db,
      'SELECT id FROM profile_subscriptions WHERE profile_id = ? AND subscription_id = ?', profileId, subId
    );
    if (existing) continue;
    
    await execute(db,
      'INSERT INTO profile_subscriptions (id, profile_id, subscription_id) VALUES (?, ?, ?)',
      mapId + '-' + subId.slice(0, 8), profileId, subId
    );
  }
  
  return success(null, 'Subscriptions added to profile');
}

// DELETE /api/profiles/:id/subscriptions/:subId
export async function removeProfileSubscription(c: Context): Promise<Response> {
  const db = getDB(c);
  const profileId = c.req.param('id');
  const subId = c.req.param('subId');
  
  await execute(db, 'DELETE FROM profile_subscriptions WHERE profile_id = ? AND subscription_id = ?', profileId, subId);
  
  return success(null, 'Subscription removed from profile');
}

// POST /api/profiles/:id/nodes
export async function addProfileNode(c: Context): Promise<Response> {
  const db = getDB(c);
  const profileId = c.req.param('id');
  const body = await c.req.json();
  
  const nodeIds = Array.isArray(body.node_ids) ? body.node_ids : [body.node_id];
  const mapId = generateId();
  
  for (const nodeId of nodeIds) {
    const node = await queryOne<any>(db, 'SELECT id FROM nodes WHERE id = ?', nodeId);
    if (!node) continue;
    
    const existing = await queryOne<any>(db,
      'SELECT id FROM profile_nodes WHERE profile_id = ? AND node_id = ?', profileId, nodeId
    );
    if (existing) continue;
    
    await execute(db,
      'INSERT INTO profile_nodes (id, profile_id, node_id) VALUES (?, ?, ?)',
      mapId + '-' + nodeId.slice(0, 8), profileId, nodeId
    );
  }
  
  return success(null, 'Nodes added to profile');
}

// DELETE /api/profiles/:id/nodes/:nodeId
export async function removeProfileNode(c: Context): Promise<Response> {
  const db = getDB(c);
  const profileId = c.req.param('id');
  const nodeId = c.req.param('nodeId');
  
  await execute(db, 'DELETE FROM profile_nodes WHERE profile_id = ? AND node_id = ?', profileId, nodeId);
  
  return success(null, 'Node removed from profile');
}

// Operator Chains CRUD

// GET /api/profiles/:id/chains
export async function listChains(c: Context): Promise<Response> {
  const db = getDB(c);
  const profileId = c.req.param('id');
  const { results } = await queryAll<any>(db,
    'SELECT * FROM operator_chains WHERE profile_id = ? ORDER BY sort_order ASC', profileId
  );
  return success(results);
}

// POST /api/profiles/:id/chains
export async function addChain(c: Context): Promise<Response> {
  const db = getDB(c);
  const profileId = c.req.param('id');
  const body = await c.req.json();
  const id = generateId();
  
  await execute(db,
    'INSERT INTO operator_chains (id, profile_id, op_type, op_config, enabled, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
    id, profileId, body.op_type, JSON.stringify(body.op_config || {}),
    body.enabled !== undefined ? body.enabled : 1, body.sort_order || 0
  );
  
  const chain = await queryOne<any>(db, 'SELECT * FROM operator_chains WHERE id = ?', id);
  return success(chain, 'Chain added');
}

// PUT /api/chains/:id
export async function updateChain(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  
  const existing = await queryOne<any>(db, 'SELECT * FROM operator_chains WHERE id = ?', id);
  if (!existing) return error('Chain not found', 404);
  
  await execute(db,
    'UPDATE operator_chains SET op_type=?, op_config=?, enabled=?, sort_order=? WHERE id=?',
    body.op_type ?? existing.op_type,
    body.op_config ? JSON.stringify(body.op_config) : existing.op_config,
    body.enabled !== undefined ? body.enabled : existing.enabled,
    body.sort_order ?? existing.sort_order,
    id
  );
  
  const chain = await queryOne<any>(db, 'SELECT * FROM operator_chains WHERE id = ?', id);
  return success(chain, 'Chain updated');
}

// DELETE /api/chains/:id
export async function deleteChain(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  await execute(db, 'DELETE FROM operator_chains WHERE id = ?', id);
  return success(null, 'Chain deleted');
}

// POST /api/chains/reorder
export async function reorderChains(c: Context): Promise<Response> {
  const db = getDB(c);
  const body = await c.req.json();
  const chainIds: string[] = body.chain_ids || [];
  
  for (let i = 0; i < chainIds.length; i++) {
    await execute(db, 'UPDATE operator_chains SET sort_order=? WHERE id=?', i, chainIds[i]);
  }
  
  return success(null, 'Chains reordered');
}
