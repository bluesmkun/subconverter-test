import type { ProcessedNode } from '../operators/chain';
import { generateClash } from './clash';
import { generateSingBox } from './singbox';
import { generateSurge } from './surge';
import { generateShadowrocket } from './shadowrocket';
import { generateV2Ray } from './v2ray';
import { generateQuantumultX } from './qx';
import { generateLoon } from './loon';

export type ClientType = 'clash' | 'clash-meta' | 'sing-box' | 'surge' | 'shadowrocket' | 'v2ray' | 'qx' | 'loon';

export interface TemplateResult {
  content: string;
  contentType: string;
}

const GENERATORS: Record<ClientType, (nodes: ProcessedNode[], name: string) => string> = {
  'clash': generateClash,
  'clash-meta': generateClash, // Clash Meta uses same format as Clash
  'sing-box': generateSingBox,
  'surge': generateSurge,
  'shadowrocket': generateShadowrocket,
  'v2ray': generateV2Ray,
  'qx': generateQuantumultX,
  'loon': generateLoon,
};

const CONTENT_TYPES: Record<string, string> = {
  'clash': 'text/yaml',
  'clash-meta': 'text/yaml',
  'sing-box': 'application/json',
  'surge': 'text/plain',
  'shadowrocket': 'text/plain',
  'v2ray': 'text/plain',
  'qx': 'text/plain',
  'loon': 'text/plain',
};

export function generateTemplate(
  clientType: ClientType,
  nodes: ProcessedNode[],
  profileName: string = 'Subconverter'
): TemplateResult {
  const generator = GENERATORS[clientType];
  if (!generator) {
    return {
      content: 'Unsupported client type',
      contentType: 'text/plain',
    };
  }
  
  return {
    content: generator(nodes, profileName),
    contentType: CONTENT_TYPES[clientType] || 'text/plain',
  };
}

export const SUPPORTED_CLIENTS: ClientType[] = [
  'clash',
  'clash-meta',
  'sing-box',
  'surge',
  'shadowrocket',
  'v2ray',
  'qx',
  'loon',
];
