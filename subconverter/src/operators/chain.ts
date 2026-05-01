import type { Node } from '../db/queries';

// Operator Chain processor for filtering, renaming, sorting, deduplicating nodes

export interface OperatorStep {
  op_type: string;
  op_config: Record<string, any>;
}

export type ProcessedNode = Pick<Node, 
  'id' | 'name' | 'protocol' | 'address' | 'port' | 'config' | 'password' | 'uuid' |
  'sni' | 'host' | 'path' | 'network' | 'tls' | 'fingerprint' | 'alpn' | 'region' | 'group_name'
>;

// Operator: Filter
function applyFilter(nodes: ProcessedNode[], config: Record<string, any>): ProcessedNode[] {
  const { mode = 'include', regions = [], protocols = [], names = [] } = config;
  
  return nodes.filter(node => {
    // Region filter
    if (regions.length > 0) {
      const matchRegion = regions.some((r: string) => 
        node.region.toLowerCase().includes(r.toLowerCase())
      );
      if (mode === 'include' && !matchRegion) return false;
      if (mode === 'exclude' && matchRegion) return false;
    }
    
    // Protocol filter
    if (protocols.length > 0) {
      const matchProtocol = protocols.some((p: string) => 
        node.protocol.toLowerCase() === p.toLowerCase()
      );
      if (mode === 'include' && !matchProtocol) return false;
      if (mode === 'exclude' && matchProtocol) return false;
    }
    
    // Name filter (regex or contains)
    if (names.length > 0) {
      const matchName = names.some((n: string) => {
        try {
          return new RegExp(n, 'i').test(node.name);
        } catch {
          return node.name.toLowerCase().includes(n.toLowerCase());
        }
      });
      if (mode === 'include' && !matchName) return false;
      if (mode === 'exclude' && matchName) return false;
    }
    
    return true;
  });
}

// Operator: Rename
function applyRename(nodes: ProcessedNode[], config: Record<string, any>): ProcessedNode[] {
  const { rules = [] } = config;
  
  return nodes.map(node => {
    let name = node.name;
    for (const rule of rules) {
      const { pattern, replacement, flags = 'gi' } = rule;
      if (!pattern) continue;
      try {
        name = name.replace(new RegExp(pattern, flags), replacement || '');
      } catch {
        // Invalid regex, skip
      }
    }
    // Clean up
    name = name.replace(/\s+/g, ' ').trim();
    return { ...node, name: name || 'Unnamed' };
  });
}

// Operator: Sort
function applySort(nodes: ProcessedNode[], config: Record<string, any>): ProcessedNode[] {
  const { by = 'name', order = 'asc' } = config;
  const sorted = [...nodes];
  
  sorted.sort((a, b) => {
    let compare = 0;
    switch (by) {
      case 'region':
        compare = a.region.localeCompare(b.region);
        break;
      case 'protocol':
        compare = a.protocol.localeCompare(b.protocol);
        break;
      case 'latency':
        compare = ((a as any).latency || 9999) - ((b as any).latency || 9999);
        break;
      case 'name':
      default:
        compare = a.name.localeCompare(b.name);
    }
    return order === 'desc' ? -compare : compare;
  });
  
  return sorted;
}

// Operator: Dedup
function applyDedup(nodes: ProcessedNode[], config: Record<string, any>): ProcessedNode[] {
  const { by = 'address', keep = 'first' } = config;
  const seen = new Map<string, ProcessedNode>();
  
  for (const node of nodes) {
    let key: string;
    switch (by) {
      case 'name':
        key = node.name;
        break;
      case 'address+port':
        key = `${node.address}:${node.port}`;
        break;
      case 'uuid':
        key = node.uuid || node.password || `${node.address}:${node.port}`;
        break;
      case 'address':
      default:
        key = node.address;
    }
    
    key = key.toLowerCase().trim();
    
    if (!seen.has(key)) {
      seen.set(key, node);
    } else if (keep === 'last') {
      seen.set(key, node);
    }
  }
  
  return Array.from(seen.values());
}

// Operator: Script (custom JS expression)
function applyScript(nodes: ProcessedNode[], config: Record<string, any>): ProcessedNode[] {
  const { expression = '' } = config;
  if (!expression) return nodes;
  
  try {
    // Limited sandbox execution using Function constructor
    // The expression should return a boolean for filter or string for rename
    const fn = new Function('node', `return (${expression})`);
    
    return nodes.map(node => {
      try {
        const result = fn({ ...node, config: typeof node.config === 'string' ? JSON.parse(node.config) : node.config });
        if (typeof result === 'boolean') {
          return result ? node : null;
        }
        if (typeof result === 'string') {
          return { ...node, name: result };
        }
        return node;
      } catch {
        return node;
      }
    }).filter((n): n is ProcessedNode => n !== null);
  } catch {
    return nodes;
  }
}

const OPERATORS: Record<string, (nodes: ProcessedNode[], config: Record<string, any>) => ProcessedNode[]> = {
  filter: applyFilter,
  rename: applyRename,
  sort: applySort,
  dedup: applyDedup,
  script: applyScript,
};

export function processOperatorChain(nodes: ProcessedNode[], steps: OperatorStep[]): ProcessedNode[] {
  const sortedSteps = [...steps].sort((a, b) => {
    const aOrder = a.op_config.sort_order || 0;
    const bOrder = b.op_config.sort_order || 0;
    return aOrder - bOrder;
  });
  
  let result = [...nodes];
  
  for (const step of sortedSteps) {
    const operatorFn = OPERATORS[step.op_type];
    if (operatorFn) {
      result = operatorFn(result, step.op_config);
    }
  }
  
  return result;
}
