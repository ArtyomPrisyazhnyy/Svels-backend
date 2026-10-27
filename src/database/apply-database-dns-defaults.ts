import { setDefaultResultOrder } from 'node:dns';
import { setDefaultAutoSelectFamily } from 'node:net';

/**
 * Prefer IPv4 before DB modules load (Neon pooler AAAA can hang on some networks).
 * Override with DB_DNS_RESULT_ORDER=verbatim to restore Node default ordering.
 */
export function applyDatabaseDnsDefaults(): void {
  const order = process.env.DB_DNS_RESULT_ORDER?.trim() || 'ipv4first';
  if (order === 'ipv4first' || order === 'verbatim') {
    setDefaultResultOrder(order);
  }

  const autoSelectFamily = process.env.DB_AUTO_SELECT_FAMILY?.trim();
  if (autoSelectFamily === 'true' || autoSelectFamily === '1') {
    setDefaultAutoSelectFamily(true);
  } else if (
    autoSelectFamily === 'false' ||
    autoSelectFamily === '0' ||
    autoSelectFamily === undefined
  ) {
    setDefaultAutoSelectFamily(false);
  }
}
