const DOMAIN_PATTERN = /^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,}$/;

export function normalizeDomain(raw: string): string {
  let host = raw.trim().toLowerCase();

  if (host.includes('://')) {
    try {
      host = new URL(host).hostname;
    } catch {
      throw new Error('INVALID_DOMAIN');
    }
  }

  host = host.split(':')[0] ?? host;

  if (host.startsWith('www.')) {
    host = host.slice(4);
  }

  return host;
}

export function isValidDomain(host: string): boolean {
  return DOMAIN_PATTERN.test(host);
}
