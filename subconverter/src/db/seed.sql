-- Built-in Template Presets (ACL4SSR style)

INSERT OR IGNORE INTO template_presets (id, name, client_type, description, config, is_builtin, created_at, updated_at)
VALUES 
(
  'tpl-acl4ssr-clash',
  'ACL4SSR 完整分流',
  'clash',
  'ACL4SSR 风格完整分流规则预设',
  '{"dns":{"enable":true,"enhanced-mode":"fake-ip"},"rules":["DOMAIN-SUFFIX,local,DIRECT","IP-CIDR,127.0.0.0/8,DIRECT","IP-CIDR,10.0.0.0/8,DIRECT","IP-CIDR,172.16.0.0/12,DIRECT","IP-CIDR,192.168.0.0/16,DIRECT","GEOIP,CN,DIRECT","MATCH,Proxy"]}',
  1, datetime('now'), datetime('now')
),
(
  'tpl-minimal-clash',
  '极简 Clash 配置',
  'clash',
  '最小化 Clash 配置，仅包含核心项',
  '{"mode":"rule","log-level":"info"}',
  1, datetime('now'), datetime('now')
),
(
  'tpl-full-singbox',
  'Sing-Box 完整配置',
  'sing-box',
  '包含 TUN 入站、DNS 分流等完整功能',
  '{"log":{"level":"info"},"dns":{"servers":[{"tag":"remote","address":"https://8.8.8.8/dns-query"}]},"inbounds":[{"type":"tun","tag":"tun-in","address":["172.19.0.1/30"],"auto_route":true}]}',
  1, datetime('now'), datetime('now')
),
(
  'tpl-surge-rule',
  'Surge 标准配置',
  'surge',
  'Surge 标准代理规则配置',
  '{}',
  1, datetime('now'), datetime('now')
);
