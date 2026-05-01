import type { Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { generateId, nowISO } from '../utils/uuid';
import { success, error } from '../utils/response';
import { queryAll, queryOne, execute } from '../db/queries';

function getDB(c: Context): D1Database {
  return (c.env as any).DB as D1Database;
}

// GET /api/nodes
export async function listNodes(c: Context): Promise<Response> {
  const db = getDB(c);
  const subId = c.req.query('subscription_id');
  const protocol = c.req.query('protocol');
  const region = c.req.query('region');
  
  let sql = 'SELECT * FROM nodes WHERE 1=1';
  const params: any[] = [];
  
  if (subId) {
    sql += ' AND subscription_id = ?';
    params.push(subId);
  }
  if (protocol) {
    sql += ' AND protocol = ?';
    params.push(protocol);
  }
  if (region) {
    sql += ' AND region LIKE ?';
    params.push(`%${region}%`);
  }
  
  sql += ' ORDER BY sort_order ASC';
  
  const { results } = await queryAll<any>(db, sql, ...params);
  return success(results);
}

// GET /api/nodes/:id
export async function getNode(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  const node = await queryOne<any>(db, 'SELECT * FROM nodes WHERE id = ?', id);
  if (!node) return error('Node not found', 404);
  return success(node);
}

// POST /api/nodes
export async function createNode(c: Context): Promise<Response> {
  const db = getDB(c);
  const body = await c.req.json();
  const id = generateId();
  const now = nowISO();
  
  const nodeConfig = body.config || {};
  if (typeof nodeConfig === 'string') {
    try { JSON.parse(nodeConfig); } catch { return error('Invalid JSON config'); }
  }
  
  await execute(db,
    `INSERT INTO nodes (id, subscription_id, name, protocol, address, port, config, password, uuid, sni, host, path, network, tls, fingerprint, alpn, region, group_name, enabled, sort_order, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    body.subscription_id || null,
    body.name || 'New Node',
    body.protocol || 'ss',
    body.address || '',
    body.port || 0,
    JSON.stringify(nodeConfig),
    body.password || '',
    body.uuid || '',
    body.sni || '',
    body.host || '',
    body.path || '',
    body.network || 'tcp',
    body.tls || 0,
    body.fingerprint || '',
    body.alpn || '',
    body.region || '',
    body.group_name || '',
    body.enabled !== undefined ? body.enabled : 1,
    body.sort_order || 0,
    now,
    now
  );
  
  const node = await queryOne<any>(db, 'SELECT * FROM nodes WHERE id = ?', id);
  return success(node, 'Node created');
}

// PUT /api/nodes/:id
export async function updateNode(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  const body = await c.req.json();
  const now = nowISO();
  
  const existing = await queryOne<any>(db, 'SELECT * FROM nodes WHERE id = ?', id);
  if (!existing) return error('Node not found', 404);
  
  const config = body.config ? (typeof body.config === 'string' ? body.config : JSON.stringify(body.config)) : existing.config;
  
  await execute(db,
    `UPDATE nodes SET name=?, protocol=?, address=?, port=?, config=?, password=?, uuid=?, sni=?, host=?, path=?, network=?, tls=?, fingerprint=?, alpn=?, region=?, group_name=?, enabled=?, sort_order=?, updated_at=? WHERE id=?`,
    body.name ?? existing.name,
    body.protocol ?? existing.protocol,
    body.address ?? existing.address,
    body.port ?? existing.port,
    config,
    body.password ?? existing.password,
    body.uuid ?? existing.uuid,
    body.sni ?? existing.sni,
    body.host ?? existing.host,
    body.path ?? existing.path,
    body.network ?? existing.network,
    body.tls !== undefined ? body.tls : existing.tls,
    body.fingerprint ?? existing.fingerprint,
    body.alpn ?? existing.alpn,
    body.region ?? existing.region,
    body.group_name ?? existing.group_name,
    body.enabled !== undefined ? body.enabled : existing.enabled,
    body.sort_order ?? existing.sort_order,
    now,
    id
  );
  
  const node = await queryOne<any>(db, 'SELECT * FROM nodes WHERE id = ?', id);
  return success(node, 'Node updated');
}

// DELETE /api/nodes/:id
export async function deleteNode(c: Context): Promise<Response> {
  const db = getDB(c);
  const id = c.req.param('id');
  
  await execute(db, 'DELETE FROM profile_nodes WHERE node_id = ?', id);
  await execute(db, 'DELETE FROM nodes WHERE id = ?', id);
  
  return success(null, 'Node deleted');
}

// POST /api/nodes/batch-import
export async function batchImportNodes(c: Context): Promise<Response> {
  const db = getDB(c);
  const body = await c.req.json();
  const nodes = body.nodes || [];
  const subscriptionId = body.subscription_id || null;
  const now = nowISO();
  
  let count = 0;
  let baseOrder = 0;
  
  if (subscriptionId) {
    const maxOrder = await queryOne<any>(db, 'SELECT MAX(sort_order) as max_order FROM nodes WHERE subscription_id = ?', subscriptionId);
    baseOrder = (maxOrder?.max_order || 0) + 1;
  }
  
  for (const node of nodes) {
    const nodeId = generateId();
    const configJson = typeof node.config === 'string' ? node.config : JSON.stringify(node.config || {});
    
    await execute(db,
      `INSERT INTO nodes (id, subscription_id, name, protocol, address, port, config, password, uuid, sni, host, path, network, tls, fingerprint, alpn, region, group_name, enabled, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      nodeId, subscriptionId, node.name || 'Node', node.protocol || 'ss',
      node.address || '', node.port || 0, configJson,
      node.password || '', node.uuid || '', node.sni || '',
      node.host || '', node.path || '', node.network || 'tcp',
      node.tls || 0, node.fingerprint || '', node.alpn || '',
      node.region || '', node.group_name || '',
      node.enabled !== undefined ? node.enabled : 1,
      baseOrder + count, now, now
    );
    count++;
  }
  
  return success({ nodes_created: count });
}

// POST /api/nodes/auto-sort
export async function autoSortNodes(c: Context): Promise<Response> {
  const db = getDB(c);
  const body = await c.req.json();
  const subscriptionId = body.subscription_id;
  const sortBy = body.sort_by || 'region'; // region, name, protocol
  
  const params: any[] = [];
  let sql = 'SELECT * FROM nodes WHERE 1=1';
  if (subscriptionId) {
    sql += ' AND subscription_id = ?';
    params.push(subscriptionId);
  }
  sql += ` ORDER BY ${sortBy} ASC`;
  
  const { results: nodes } = await queryAll<any>(db, sql, ...params);
  
  for (let i = 0; i < nodes.length; i++) {
    await execute(db, 'UPDATE nodes SET sort_order=? WHERE id=?', i, nodes[i].id);
  }
  
  return success({ sorted: nodes.length });
}
