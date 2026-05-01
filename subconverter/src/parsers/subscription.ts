import { generateId, nowISO } from '../utils/uuid';

// Protocol parsers for subscription URLs

interface ParsedNode {
  name: string;
  protocol: string;
  address: string;
  port: number;
  config: Record<string, any>;
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
}

export function parseSS(uri: string): ParsedNode | null {
  // ss://base64(method:password)@host:port or ss://base64(method:password@host:port)
  try {
    const trimmed = uri.replace(/^ss:\/\//, '');
    // Handle new format with #name
    const [encoded, fragment] = trimmed.split('#');
    const decoded = atob(encoded);
    
    let method: string, password: string, address: string, port: number;
    
    if (decoded.includes('@')) {
      const [userinfo, server] = decoded.split('@');
      [method, password] = userinfo.split(':');
      const parts = server.split(':');
      address = parts[0];
      port = parseInt(parts[1]);
    } else {
      // Legacy format: method:password@host:port all encoded together
      const parts = decoded.split(':');
      if (parts.length >= 4) {
        method = parts[0];
        address = parts[parts.length - 2];
        port = parseInt(parts[parts.length - 1]);
        password = parts.slice(1, -2).join(':');
      } else {
        return null;
      }
    }
    
    const name = fragment ? decodeURIComponent(fragment) : `${address}:${port}`;
    
    return {
      name,
      protocol: method.startsWith('2022-') ? 'ss2022' : 'ss',
      address,
      port,
      config: { method, password },
      password,
      uuid: '',
      sni: '',
      host: '',
      path: '',
      network: 'tcp',
      tls: 0,
      fingerprint: '',
      alpn: '',
      region: '',
    };
  } catch {
    return null;
  }
}

export function parseVMess(uri: string): ParsedNode | null {
  try {
    const base64 = uri.replace(/^vmess:\/\//, '');
    const json = atob(base64);
    const cfg = JSON.parse(json);
    
    return {
      name: cfg.ps || `${cfg.add}:${cfg.port}`,
      protocol: 'vmess',
      address: cfg.add || '',
      port: parseInt(cfg.port) || 0,
      config: {
        v: cfg.v || '2',
        id: cfg.id || '',
        aid: cfg.aid || 0,
        scy: cfg.scy || 'auto',
        net: cfg.net || 'tcp',
        type: cfg.type || 'none',
        host: cfg.host || '',
        path: cfg.path || '',
        tls: cfg.tls || '',
        sni: cfg.sni || '',
        alpn: cfg.alpn || '',
        fp: cfg.fp || '',
      },
      password: '',
      uuid: cfg.id || '',
      sni: cfg.sni || '',
      host: cfg.host || '',
      path: cfg.path || '',
      network: cfg.net || 'tcp',
      tls: cfg.tls === 'tls' ? 1 : 0,
      fingerprint: cfg.fp || '',
      alpn: cfg.alpn || '',
      region: '',
    };
  } catch {
    return null;
  }
}

export function parseVLESS(uri: string): ParsedNode | null {
  try {
    const trimmed = uri.replace(/^vless:\/\//, '');
    const [userinfo, rest] = trimmed.split('@');
    const uuid = userinfo;
    const [serverPart, ...queryParts] = rest.split('?');
    const [address, portStr] = serverPart.split(':');
    const port = parseInt(portStr);
    
    const fragmentIndex = uri.lastIndexOf('#');
    let name = `${address}:${port}`;
    if (fragmentIndex > 0) {
      name = decodeURIComponent(uri.slice(fragmentIndex + 1));
    }
    
    const params: Record<string, string> = {};
    if (queryParts.length > 0) {
      const queryStr = queryParts.join('?').split('#')[0];
      new URLSearchParams(queryStr).forEach((v, k) => { params[k] = v; });
    }
    
    const tls = params.security === 'tls' || params.security === 'reality' ? 1 : 0;
    
    return {
      name,
      protocol: 'vless',
      address,
      port,
      config: {
        uuid,
        flow: params.flow || '',
        encryption: params.encryption || 'none',
        security: params.security || 'none',
        sni: params.sni || '',
        alpn: params.alpn || '',
        fp: params.fp || '',
        pbk: params.pbk || '',
        sid: params.sid || '',
        type: params.type || 'tcp',
        host: params.host || '',
        path: params.path || '',
        authority: params.authority || '',
        serviceName: params.serviceName || '',
        mode: params.mode || '',
      },
      password: '',
      uuid,
      sni: params.sni || '',
      host: params.host || '',
      path: params.path || '',
      network: params.type || 'tcp',
      tls,
      fingerprint: params.fp || '',
      alpn: params.alpn || '',
      region: '',
    };
  } catch {
    return null;
  }
}

export function parseTrojan(uri: string): ParsedNode | null {
  try {
    const trimmed = uri.replace(/^trojan:\/\//, '');
    const [userinfo, rest] = trimmed.split('@');
    const password = userinfo;
    
    let serverPart = rest;
    const queryIndex = serverPart.indexOf('?');
    
    let address: string, portStr: string;
    if (queryIndex > 0) {
      [address, portStr] = serverPart.slice(0, queryIndex).split(':');
    } else {
      const fragIdx = serverPart.indexOf('#');
      const clean = fragIdx > 0 ? serverPart.slice(0, fragIdx) : serverPart;
      [address, portStr] = clean.split(':');
    }
    const port = parseInt(portStr);
    
    const params: Record<string, string> = {};
    if (queryIndex > 0) {
      const queryStr = serverPart.slice(queryIndex + 1).split('#')[0];
      new URLSearchParams(queryStr).forEach((v, k) => { params[k] = v; });
    }
    
    const fragmentIndex = uri.lastIndexOf('#');
    let name = `${address}:${port}`;
    if (fragmentIndex > 0) {
      name = decodeURIComponent(uri.slice(fragmentIndex + 1));
    }
    
    return {
      name,
      protocol: 'trojan',
      address,
      port,
      config: {
        password,
        sni: params.sni || '',
        alpn: params.alpn || '',
        fp: params.fp || '',
        type: params.type || 'tcp',
        host: params.host || '',
        path: params.path || '',
      },
      password,
      uuid: '',
      sni: params.sni || '',
      host: params.host || '',
      path: params.path || '',
      network: params.type || 'tcp',
      tls: 1,
      fingerprint: params.fp || '',
      alpn: params.alpn || '',
      region: '',
    };
  } catch {
    return null;
  }
}

export function parseHysteria2(uri: string): ParsedNode | null {
  try {
    const trimmed = uri.replace(/^(hysteria2|hy2):\/\//, '');
    const [userinfo, rest] = trimmed.split('@');
    let password = userinfo;
    let auth = '';
    
    // Format: password?auth=xxx or just password
    const authIndex = userinfo.indexOf('?');
    if (authIndex > 0) {
      password = userinfo.slice(0, authIndex);
      auth = userinfo.slice(authIndex + 1).replace('auth=', '');
    }
    
    let [address, portStr] = rest.split(':');
    let port = parseInt(portStr);
    
    const fragmentIndex = uri.lastIndexOf('#');
    let name = `${address}:${port}`;
    if (fragmentIndex > 0) {
      name = decodeURIComponent(uri.slice(fragmentIndex + 1));
    }
    
    const params: Record<string, string> = {};
    const queryIndex = uri.indexOf('?');
    if (queryIndex > 0) {
      const queryStr = uri.slice(queryIndex + 1).split('#')[0];
      new URLSearchParams(queryStr).forEach((v, k) => { params[k] = v; });
    }
    
    return {
      name,
      protocol: 'hysteria2',
      address,
      port,
      config: {
        password,
        auth,
        sni: params.sni || '',
        alpn: params.alpn || '',
        obfs: params.obfs || '',
        'obfs-password': params['obfs-password'] || '',
        insecure: params.insecure || '0',
        pinSHA256: params.pinSHA256 || '',
      },
      password,
      uuid: '',
      sni: params.sni || '',
      host: '',
      path: '',
      network: 'udp',
      tls: 1,
      fingerprint: '',
      alpn: params.alpn || '',
      region: '',
    };
  } catch {
    return null;
  }
}

export function parseTUIC(uri: string): ParsedNode | null {
  try {
    const trimmed = uri.replace(/^tuic:\/\//, '');
    const [userinfo, rest] = trimmed.split('@');
    
    let uuid = userinfo;
    let password = '';
    const colonIndex = userinfo.indexOf(':');
    if (colonIndex > 0) {
      uuid = userinfo.slice(0, colonIndex);
      password = userinfo.slice(colonIndex + 1);
    }
    
    let [address, portStr] = rest.split(':');
    
    const params: Record<string, string> = {};
    const queryIndex = uri.indexOf('?');
    if (queryIndex > 0) {
      const queryStr = uri.slice(queryIndex + 1).split('#')[0];
      new URLSearchParams(queryStr).forEach((v, k) => { params[k] = v; });
    }
    
    let port = parseInt(portStr);
    if (isNaN(port)) {
      // portStr might contain query params
      port = parseInt(portStr.split('?')[0]);
    }
    
    const fragmentIndex = uri.lastIndexOf('#');
    let name = `${address}:${port}`;
    if (fragmentIndex > 0) {
      name = decodeURIComponent(uri.slice(fragmentIndex + 1));
    }
    
    return {
      name,
      protocol: 'tuic',
      address,
      port,
      config: {
        uuid,
        password,
        congestion_control: params.congestion_control || 'bbr',
        alpn: params.alpn || '',
        sni: params.sni || '',
        disable_sni: params.disable_sni || '0',
        udp_relay_mode: params.udp_relay_mode || 'native',
      },
      password,
      uuid,
      sni: params.sni || '',
      host: '',
      path: '',
      network: 'udp',
      tls: 1,
      fingerprint: '',
      alpn: params.alpn || '',
      region: '',
    };
  } catch {
    return null;
  }
}

export function parseSnell(uri: string): ParsedNode | null {
  try {
    const trimmed = uri.replace(/^snell:\/\//, '');
    const [userinfo, rest] = trimmed.split('@');
    const password = userinfo;
    
    let [address, portStr] = rest.split(':');
    let port = parseInt(portStr);
    
    const params: Record<string, string> = {};
    const queryIndex = uri.indexOf('?');
    if (queryIndex > 0) {
      const queryStr = uri.slice(queryIndex + 1).split('#')[0];
      new URLSearchParams(queryStr).forEach((v, k) => { params[k] = v; });
    }
    
    const fragmentIndex = uri.lastIndexOf('#');
    let name = `${address}:${port}`;
    if (fragmentIndex > 0) {
      name = decodeURIComponent(uri.slice(fragmentIndex + 1));
    }
    
    return {
      name,
      protocol: 'snell',
      address,
      port,
      config: {
        password,
        version: params.version || '4',
        obfs: params.obfs || '',
        'obfs-host': params['obfs-host'] || '',
      },
      password,
      uuid: '',
      sni: '',
      host: '',
      path: '',
      network: 'tcp',
      tls: 0,
      fingerprint: '',
      alpn: '',
      region: '',
    };
  } catch {
    return null;
  }
}

export function parseWireGuard(uri: string): ParsedNode | null {
  try {
    const trimmed = uri.replace(/^wireguard:\/\//, '');
    let config = trimmed;
    
    const fragmentIndex = config.lastIndexOf('#');
    let name = 'WireGuard';
    if (fragmentIndex > 0) {
      name = decodeURIComponent(config.slice(fragmentIndex + 1));
      config = config.slice(0, fragmentIndex);
    }
    
    const params: Record<string, string> = {};
    const queryIndex = config.indexOf('?');
    if (queryIndex > 0) {
      new URLSearchParams(config.slice(queryIndex + 1)).forEach((v, k) => { params[k] = v; });
      config = config.slice(0, queryIndex);
    }
    
    const parts = config.split('@');
    let privateKey = '', address = '', port = 0;
    if (parts.length === 2) {
      privateKey = parts[0];
      [address, port] = parts[1].split(':');
      port = parseInt(port);
    }
    
    return {
      name,
      protocol: 'wireguard',
      address,
      port,
      config: {
        privateKey,
        publicKey: params.publicKey || '',
        presharedKey: params.presharedKey || '',
        mtu: params.mtu || '1420',
        dns: params.dns || '',
        addresses: params.addresses || '',
      },
      password: '',
      uuid: '',
      sni: '',
      host: '',
      path: '',
      network: 'udp',
      tls: 0,
      fingerprint: '',
      alpn: '',
      region: '',
    };
  } catch {
    return null;
  }
}

export function parseSOCKS5(uri: string): ParsedNode | null {
  try {
    const trimmed = uri.replace(/^socks5:\/\//, '');
    let auth = '';
    let rest = trimmed;
    
    if (trimmed.includes('@')) {
      [auth, rest] = trimmed.split('@');
    }
    
    const [address, portStr] = rest.split(':');
    const port = parseInt(portStr);
    
    const username = auth.split(':')[0] || '';
    const password = auth.split(':')[1] || '';
    
    const fragmentIndex = uri.lastIndexOf('#');
    let name = `${address}:${port}`;
    if (fragmentIndex > 0) {
      name = decodeURIComponent(uri.slice(fragmentIndex + 1));
    }
    
    return {
      name,
      protocol: 'socks5',
      address,
      port,
      config: { username, password },
      password,
      uuid: '',
      sni: '',
      host: '',
      path: '',
      network: 'tcp',
      tls: 0,
      fingerprint: '',
      alpn: '',
      region: '',
    };
  } catch {
    return null;
  }
}

export function parseAnyTLS(uri: string): ParsedNode | null {
  try {
    const trimmed = uri.replace(/^anytls:\/\//, '');
    const [userinfo, rest] = trimmed.split('@');
    const password = userinfo;
    
    const [address, portStr] = rest.split(':');
    const port = parseInt(portStr);
    
    const fragmentIndex = uri.lastIndexOf('#');
    let name = `${address}:${port}`;
    if (fragmentIndex > 0) {
      name = decodeURIComponent(uri.slice(fragmentIndex + 1));
    }
    
    return {
      name,
      protocol: 'anytls',
      address,
      port,
      config: { password },
      password,
      uuid: '',
      sni: '',
      host: '',
      path: '',
      network: 'tcp',
      tls: 1,
      fingerprint: '',
      alpn: '',
      region: '',
    };
  } catch {
    return null;
  }
}

export function parseHTTP(uri: string): ParsedNode | null {
  try {
    const trimmed = uri.replace(/^https?:\/\//, '');
    
    let auth = '';
    let rest = trimmed;
    if (trimmed.includes('@')) {
      [auth, rest] = trimmed.split('@');
    }
    
    const [address, portStr] = rest.split(':');
    const port = parseInt(portStr);
    
    const username = auth.split(':')[0] || '';
    const password = auth.split(':')[1] || '';
    
    const fragmentIndex = uri.lastIndexOf('#');
    let name = `${address}:${port}`;
    if (fragmentIndex > 0) {
      name = decodeURIComponent(uri.slice(fragmentIndex + 1));
    }
    
    return {
      name,
      protocol: 'http',
      address,
      port,
      config: { username, password, tls: uri.startsWith('https://') },
      password,
      uuid: '',
      sni: '',
      host: '',
      path: '',
      network: 'tcp',
      tls: uri.startsWith('https://') ? 1 : 0,
      fingerprint: '',
      alpn: '',
      region: '',
    };
  } catch {
    return null;
  }
}

// Main parse function - detects protocol and parses accordingly
const PARSERS: Record<string, (uri: string) => ParsedNode | null> = {
  'ss://': parseSS,
  'ss2022://': parseSS,
  'vmess://': parseVMess,
  'vless://': parseVLESS,
  'trojan://': parseTrojan,
  'hysteria2://': parseHysteria2,
  'hy2://': parseHysteria2,
  'tuic://': parseTUIC,
  'snell://': parseSnell,
  'wireguard://': parseWireGuard,
  'socks5://': parseSOCKS5,
  'anytls://': parseAnyTLS,
  'http://': parseHTTP,
  'https://': parseHTTP,
};

export function parseNode(uri: string): ParsedNode | null {
  for (const [prefix, parser] of Object.entries(PARSERS)) {
    if (uri.startsWith(prefix)) {
      return parser(uri);
    }
  }
  return null;
}

// Parse a full subscription content (base64 or plain text list)
export function parseSubscriptionContent(content: string): ParsedNode[] {
  let decoded = content;
  
  // Try base64 decode
  try {
    decoded = atob(content);
  } catch {
    // Not base64, use as-is
  }
  
  // Split by newlines and try to parse each line
  const lines = decoded.split(/[\r\n]+/).filter(l => l.trim());
  const nodes: ParsedNode[] = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip comments and special lines
    if (trimmed.startsWith('#') || trimmed.startsWith('//') || trimmed.startsWith('STATUS=') || trimmed.startsWith('REMARKS=')) {
      continue;
    }
    const node = parseNode(trimmed);
    if (node) {
      nodes.push(node);
    }
  }
  
  return nodes;
}
