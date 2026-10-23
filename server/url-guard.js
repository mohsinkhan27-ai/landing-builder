import dns from 'node:dns/promises';
import net from 'node:net';

const BLOCKED_HOSTS = new Set([
  'localhost',
  'localhost.localdomain',
  'metadata',
  'metadata.google.internal',
  'instance-data',
]);

const V4_BLOCKS = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
];

const v4ToInt = (ip) => ip.split('.').reduce((n, part) => ((n << 8) + Number(part)) >>> 0, 0);
const inV4Block = (ip, base, bits) => {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (v4ToInt(ip) & mask) === (v4ToInt(base) & mask);
};

export function isPrivateIp(address) {
  const ip = String(address || '').trim().toLowerCase().replace(/^\[|\]$/g, '').split('%')[0];
  if (net.isIPv4(ip)) return V4_BLOCKS.some(([base, bits]) => inV4Block(ip, base, bits));
  if (!net.isIPv6(ip)) return true;
  if (ip === '::' || ip === '::1') return true;
  if (ip.startsWith('::ffff:')) return true;
  if (/^f[cd][0-9a-f]{2}:/.test(ip)) return true;
  if (/^fe[89ab][0-9a-f]:/.test(ip)) return true;
  if (/^ff[0-9a-f]{2}:/.test(ip)) return true;
  if (/^2001:0?db8:/.test(ip)) return true;
  return false;
}

export function isBlockedHostname(hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return true;
  if (BLOCKED_HOSTS.has(host)) return true;
  if (host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;
  if (net.isIP(host)) return isPrivateIp(host);
  return false;
}

export function isBlockedRequestUrl(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return true;
  }
  if (['data:', 'blob:', 'about:'].includes(parsed.protocol)) return false;
  if (!['http:', 'https:'].includes(parsed.protocol)) return true;
  return isBlockedHostname(parsed.hostname);
}

export async function assertPublicUrl(raw) {
  let parsed;
  try {
    parsed = raw instanceof URL ? raw : new URL(String(raw));
  } catch {
    throw new Error('That does not look like a valid web address.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only http and https addresses are supported.');
  }
  if (parsed.username || parsed.password) {
    throw new Error('Addresses with a username or password are not supported.');
  }
  if (isBlockedHostname(parsed.hostname)) {
    throw new Error('That address points to a private or local network, which cannot be analyzed.');
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '');
  if (net.isIP(host)) return parsed;
  let addresses;
  try {
    addresses = await dns.lookup(host, { all: true, verbatim: true });
  } catch {
    throw new Error('Could not find that website. Check the address and try again.');
  }
  if (!addresses.length) throw new Error('Could not find that website. Check the address and try again.');
  if (addresses.some(({ address }) => isPrivateIp(address))) {
    throw new Error('That address points to a private or local network, which cannot be analyzed.');
  }
  return parsed;
}

export async function safeFetch(raw, options = {}, maxRedirects = 5) {
  let current = await assertPublicUrl(raw);
  for (let hop = 0; hop <= maxRedirects; hop += 1) {
    const response = await fetch(current, { ...options, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    await response.body?.cancel().catch(() => {});
    current = await assertPublicUrl(new URL(location, current).href);
  }
  throw new Error('The website redirected too many times.');
}
