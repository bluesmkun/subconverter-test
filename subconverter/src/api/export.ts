import type { Context } from 'hono';
import type { D1Database } from '@cloudflare/workers-types';
import { success, error, corsResponse } from '../utils/response';
import { queryAll, queryOne } from '../db/queries';
import { processOperatorChain } from '../operators/chain';
import { generateTemplate, SUPPORTED_CLIENTS, type ClientType } from '../templates/index';

function getDB(c: Context): D1Database {
  return (c.env as any).DB as D1Database;
}

// GET /export/:slug?client=clash
export async function exportProfile(c: Context): Promise<Response> {
  const db = getDB(c);
  const slug = c.req.param('slug');
  const clientType = (c.req.query('client') || 'clash') as ClientType;
  
  const profile = await queryOne<any>(db, 'SELECT * FROM profiles WHERE slug = ? AND enabled = 1', slug);
  if (!profile) return error('Profile not found or disabled', 404);
  
  // Get nodes from subscriptions associated with this profile
  const subNodesResult = await queryAll<any>(db,
    `SELECT n.* FROM nodes n
     INNER JOIN profile_subscriptions ps ON n.subscription_id = ps.subscription_id
     WHERE ps.profile_id = ? AND n.enabled = 1
     ORDER BY n.sort_order ASC`, profile.id
  );
  
  // Get direct nodes
  const directNodesResult = await queryAll<any>(db,
    `SELECT n.* FROM nodes n
     INNER JOIN profile_nodes pn ON n.id = pn.node_id
     WHERE pn.profile_id = ? AND n.enabled = 1
     ORDER BY pn.sort_order ASC`, profile.id
  );
  
  // Merge nodes
  const nodeMap = new Map<string, any>();
  for (const node of subNodesResult.results) {
    nodeMap.set(node.id, node);
  }
  for (const node of directNodesResult.results) {
    nodeMap.set(node.id, node);
  }
  
  let nodes = Array.from(nodeMap.values());
  
  // Apply operator chains
  const chains = await queryAll<any>(db,
    'SELECT * FROM operator_chains WHERE profile_id = ? AND enabled = 1 ORDER BY sort_order ASC', profile.id
  );
  
  if (chains.results.length > 0) {
    const steps = chains.results.map(c => ({
      op_type: c.op_type,
      op_config: typeof c.op_config === 'string' ? JSON.parse(c.op_config) : c.op_config,
    }));
    
    nodes = processOperatorChain(nodes, steps);
  }
  
  // Generate template
  const preferredClient = clientType || profile.default_client || 'clash';
  const { content, contentType } = generateTemplate(preferredClient, nodes, profile.name);
  
  return corsResponse(content, contentType + '; charset=utf-8');
}

// GET /api/export/preview?client=clash&subscription_ids=...&node_ids=...
export async function previewExport(c: Context): Promise<Response> {
  const db = getDB(c);
  const clientType = (c.req.query('client') || 'clash') as ClientType;
  const subIds = c.req.query('subscription_ids')?.split(',') || [];
  const nodeIds = c.req.query('node_ids')?.split(',') || [];
  
  const nodeMap = new Map<string, any>();
  
  // Get nodes from subscriptions
  for (const subId of subIds) {
    const nodes = await queryAll<any>(db,
      'SELECT * FROM nodes WHERE subscription_id = ? AND enabled = 1 ORDER BY sort_order ASC', subId
    );
    for (const node of nodes.results) {
      nodeMap.set(node.id, node);
    }
  }
  
  // Get direct nodes
  for (const nodeId of nodeIds) {
    const node = await queryOne<any>(db, 'SELECT * FROM nodes WHERE id = ? AND enabled = 1', nodeId);
    if (node) nodeMap.set(node.id, node);
  }
  
  const nodes = Array.from(nodeMap.values());
  const { content, contentType } = generateTemplate(clientType, nodes, 'Preview');
  
  return corsResponse(content, contentType + '; charset=utf-8');
}

// GET /api/clients
export async function listClients(c: Context): Promise<Response> {
  return success(SUPPORTED_CLIENTS.map(c => ({
    id: c,
    name: c === 'clash' ? 'Clash / Clash Meta' :
          c === 'sing-box' ? 'Sing-Box' :
          c === 'surge' ? 'Surge' :
          c === 'shadowrocket' ? 'Shadowrocket' :
          c === 'v2ray' ? 'V2RayN / V2RayNG' :
          c === 'qx' ? 'Quantumult X' :
          c === 'loon' ? 'Loon' : c,
  })));
}
