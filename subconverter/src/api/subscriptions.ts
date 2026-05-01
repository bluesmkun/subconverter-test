import type { Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { generateId, nowISO } from '../utils/uuid';
import { success, error, getParam } from '../utils/response';
import { queryAll, queryOne, execute } from '../db/queries';
import { parseSubscriptionContent } from '../parsers/subscription';

function getDB(c: Context): D1Database {
  return (c.env as any).DB as D1Database;
}

// GET /api/subscriptions
export async function listSubscriptions(c: Context): Promise<Response> {
  const db = getDB(c);
  const { results } = await queryAll<any>(db, 'SELECT * FROM subscriptions ORDER BY sort_order ASC');
  return success(results);
}

// GET /api/subscriptions/:id
export async function getSubscription(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  const sub = await queryOne<any>(db, 'SELECT * FROM subscriptions WHERE id = ?', id);
  if (!sub) return error('Subscription not found', 404);
  return success(sub);
}

// POST /api/subscriptions
export async function createSubscription(c: Context): Promise<Response> {
  const db = getDB(c);
  const body = await c.req.json();
  const id = generateId();
  const now = nowISO();
  
  await execute(db,
    `INSERT INTO subscriptions (id, name, url, type, user_agent, sync_interval, enabled, sort_order, notes, created_at, updated_at) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.name || 'New Subscription',
    body.url || '',
    body.type || 'remote',
    body.user_agent || 'subconverter/1.0',
    body.sync_interval || 3600,
    body.enabled !== undefined ? body.enabled : 1,
    body.sort_order || 0,
    body.notes || '',
    now,
    now
  );
  
  const sub = await queryOne<any>(db, 'SELECT * FROM subscriptions WHERE id = ?', id);
  return success(sub, 'Subscription created');
}

// PUT /api/subscriptions/:id
export async function updateSubscription(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = nowISO();
  
  const existing = await queryOne<any>(db, 'SELECT * FROM subscriptions WHERE id = ?', id);
  if (!existing) return error('Subscription not found', 404);
  
  await execute(db,
    `UPDATE subscriptions SET name=?, url=?, type=?, user_agent=?, sync_interval=?, enabled=?, sort_order=?, notes=?, updated_at=? WHERE id=?`,
    body.name ?? existing.name,
    body.url ?? existing.url,
    body.type ?? existing.type,
    body.user_agent ?? existing.user_agent,
    body.sync_interval ?? existing.sync_interval,
    body.enabled !== undefined ? body.enabled : existing.enabled,
    body.sort_order ?? existing.sort_order,
    body.notes ?? existing.notes,
    now,
    id
  );
  
  const sub = await queryOne<any>(db, 'SELECT * FROM subscriptions WHERE id = ?', id);
  return success(sub, 'Subscription updated');
}

// DELETE /api/subscriptions/:id
export async function deleteSubscription(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  
  await execute(db, 'DELETE FROM profile_subscriptions WHERE subscription_id = ?', id);
  await execute(db, 'DELETE FROM nodes WHERE subscription_id = ?', id);
  await execute(db, 'DELETE FROM subscriptions WHERE id = ?', id);
  
  return success(null, 'Subscription deleted');
}

// POST /api/subscriptions/:id/sync
export async function syncSubscription(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  
  const sub = await queryOne<any>(db, 'SELECT * FROM subscriptions WHERE id = ?', id);
  if (!sub) return error('Subscription not found', 404);
  
  try {
    const response = await fetch(sub.url, {
      headers: { 'User-Agent': sub.user_agent || 'subconverter/1.0' },
    });
    
    if (!response.ok) {
      return error(`Failed to fetch: ${response.status} ${response.statusText}`, 502);
    }
    
    const content = await response.text();
    const parsedNodes = parseSubscriptionContent(content);
    
    // Delete old nodes
    await execute(db, 'DELETE FROM nodes WHERE subscription_id = ?', id);
    
    // Insert new nodes
    let count = 0;
    for (const node of parsedNodes) {
      const nodeId = generateId();
      const now = nowISO();
      const configJson = JSON.stringify(node.config);
      
      await execute(db,
        `INSERT INTO nodes (id, subscription_id, name, protocol, address, port, config, password, uuid, sni, host, path, network, tls, fingerprint, alpn, region, enabled, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        nodeId, id, node.name, node.protocol, node.address, node.port,
        configJson, node.password, node.uuid, node.sni, node.host, node.path,
        node.network, node.tls, node.fingerprint, node.alpn, node.region,
        1, count, now, now
      );
      count++;
    }
    
    // Update subscription metadata
    await execute(db, 
      'UPDATE subscriptions SET node_count=?, last_synced_at=?, updated_at=? WHERE id=?',
      count, now, now, id
    );
    
    return success({ nodes_found: count }, `Synced ${count} nodes`);
  } catch (e: any) {
    return error(`Sync failed: ${e.message}`, 500);
  }
}

// POST /api/subscriptions/batch-import
export async function batchImport(c: Context): Promise<Response> {
  const db = getDB(c);
  const body = await c.req.json();
  const content = body.content || '';
  const parsedNodes = parseSubscriptionContent(content);
  
  // Create a manual subscription to hold these nodes
  const subId = generateId();
  const now = nowISO();
  const subName = body.name || `Manual Import ${new Date().toLocaleDateString()}`;
  
  await execute(db,
    `INSERT INTO subscriptions (id, name, url, type, enabled, sort_order, created_at, updated_at)
     VALUES (?, ?, '', 'manual', 1, 0, ?, ?)`,
    subId, subName, now, now
  );
  
  let count = 0;
  for (const node of parsedNodes) {
    const nodeId = generateId();
    const configJson = JSON.stringify(node.config);
    
    await execute(db,
      `INSERT INTO nodes (id, subscription_id, name, protocol, address, port, config, password, uuid, sni, host, path, network, tls, fingerprint, alpn, region, enabled, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      nodeId, subId, node.name, node.protocol, node.address, node.port,
      configJson, node.password, node.uuid, node.sni, node.host, node.path,
      node.network, node.tls, node.fingerprint, node.alpn, node.region,
      1, count, now, now
    );
    count++;
  }
  
  await execute(db, 'UPDATE subscriptions SET node_count=? WHERE id=?', count, subId);
  
  return success({ subscription_id: subId, nodes_imported: count });
}
