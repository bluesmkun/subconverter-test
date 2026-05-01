import type { ProcessedNode } from '../operators/chain';

export function generateSingBox(nodes: ProcessedNode[], profileName: string = 'Subconverter'): string {
  const config: any = {
    log: {
      level: 'info',
      timestamp: true,
    },
    dns: {
      servers: [
        { tag: 'dns-direct', address: 'https://1.1.1.1/dns-query', detour: 'direct' },
        { tag: 'dns-remote', address: 'https://8.8.8.8/dns-query', detour: 'proxy' },
      ],
      rules: [
        { rule_set: 'geosite-cn', server: 'dns-direct' },
        { rule_set: 'geoip-cn', server: 'dns-direct' },
      ],
    },
    inbounds: [
      { type: 'tun', tag: 'tun-in', address: ['172.19.0.1/30'], auto_route: true, strict_route: true },
      { type: 'mixed', tag: 'mixed-in', listen: '127.0.0.1', listen_port: 2080 },
    ],
    outbounds: [],
    route: {
      rules: [
        { protocol: 'dns', outbound: 'dns-out' },
        { rule_set: 'geoip-cn', outbound: 'direct' },
        { rule_set: 'geosite-cn', outbound: 'direct' },
        { domain_suffix: 'local', outbound: 'direct' },
      ],
      final: 'proxy',
      rule_set: [
        { type: 'remote', tag: 'geoip-cn', format: 'binary', url: 'https://raw.githubusercontent.com/SagerNet/sing-geoip/rule-set/geoip-cn.srs' },
        { type: 'remote', tag: 'geosite-cn', format: 'binary', url: 'https://raw.githubusercontent.com/SagerNet/sing-geosite/rule-set/geosite-cn.srs' },
      ],
    },
  };

  // Build outbounds
  const directOut = { type: 'direct', tag: 'direct' };
  const dnsOut = { type: 'dns', tag: 'dns-out' };
  
  const outbounds: any[] = [directOut, dnsOut];
  
  // Proxy nodes
  const proxyTags: string[] = [];
  
  for (const node of nodes) {
    const config = typeof node.config === 'string' ? JSON.parse(node.config) : node.config;
    const tag = `proxy-${node.id}`;
    proxyTags.push(tag);
    
    let outbound: any = { tag };
    
    switch (node.protocol) {
      case 'ss':
      case 'ss2022':
        outbound.type = 'shadowsocks';
        outbound.server = node.address;
        outbound.server_port = node.port;
        outbound.method = config.method || 'aes-256-gcm';
        outbound.password = node.password;
        break;
        
      case 'vmess':
        outbound.type = 'vmess';
        outbound.server = node.address;
        outbound.server_port = node.port;
        outbound.uuid = node.uuid;
        outbound.security = config.scy || 'auto';
        outbound.alter_id = config.aid || 0;
        if (node.network === 'ws') {
          outbound.transport = {
            type: 'ws',
            path: node.path || '/',
            headers: { Host: node.host || node.address },
          };
        }
        if (node.tls) {
          outbound.tls = { enabled: true, server_name: node.sni || node.address };
        }
        break;
        
      case 'vless':
        outbound.type = 'vless';
        outbound.server = node.address;
        outbound.server_port = node.port;
        outbound.uuid = node.uuid;
        if (config.flow) outbound.flow = config.flow;
        if (node.network === 'ws') {
          outbound.transport = { type: 'ws', path: node.path || '/' };
        }
        if (node.tls) {
          outbound.tls = { enabled: true, server_name: node.sni || node.address };
          if (config.security === 'reality') {
            outbound.tls.reality = {
              enabled: true,
              public_key: config.pbk || '',
              short_id: config.sid || '',
            };
          }
        }
        break;
        
      case 'trojan':
        outbound.type = 'trojan';
        outbound.server = node.address;
        outbound.server_port = node.port;
        outbound.password = node.password;
        if (node.tls) {
          outbound.tls = { enabled: true, server_name: node.sni || node.address };
        }
        if (node.network === 'ws') {
          outbound.transport = { type: 'ws', path: node.path || '/' };
        }
        break;
        
      case 'hysteria2':
        outbound.type = 'hysteria2';
        outbound.server = node.address;
        outbound.server_port = node.port;
        outbound.password = node.password;
        if (node.tls) {
          outbound.tls = {
            enabled: true,
            server_name: node.sni || node.address,
            alpn: node.alpn ? node.alpn.split(',').map(a => a.trim()) : undefined,
          };
        }
        break;
        
      case 'tuic':
        outbound.type = 'tuic';
        outbound.server = node.address;
        outbound.server_port = node.port;
        outbound.uuid = node.uuid;
        outbound.password = node.password;
        if (node.tls) {
          outbound.tls = {
            enabled: true,
            server_name: node.sni || node.address,
            alpn: node.alpn ? node.alpn.split(',').map(a => a.trim()) : undefined,
          };
        }
        break;
        
      case 'wireguard':
        outbound.type = 'wireguard';
        outbound.server = node.address;
        outbound.server_port = node.port;
        outbound.private_key = config.privateKey || '';
        outbound.peers = [{
          server: node.address,
          server_port: node.port,
          public_key: config.publicKey || '',
          pre_shared_key: config.presharedKey || '',
        }];
        break;
        
      default:
        outbound.type = 'direct';
        outbound.tag = tag;
        outbound.detour = 'proxy';
    }
    
    outbounds.push(outbound);
  }
  
  // Selector outbound
  const selector: any = {
    type: 'selector',
    tag: 'proxy',
    outbounds: proxyTags,
    default: proxyTags[0] || 'direct',
  };
  outbounds.push(selector);
  
  // Auto selectors by region
  const regionMap = new Map<string, string[]>();
  for (const node of nodes) {
    const region = node.region || node.protocol;
    if (!regionMap.has(region)) regionMap.set(region, []);
    regionMap.get(region)!.push(`proxy-${node.id}`);
  }
  
  for (const [region, tags] of regionMap) {
    outbounds.push({
      type: 'urltest',
      tag: `auto-${region.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}`,
      outbounds: tags,
      url: 'http://www.gstatic.com/generate_204',
      interval: '5m',
    });
  }
  
  config.outbounds = outbounds;
  
  return JSON.stringify(config, null, 2);
}
