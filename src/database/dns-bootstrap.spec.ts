import { setDefaultResultOrder } from 'node:dns';
import { applyDatabaseDnsDefaults } from './apply-database-dns-defaults';

jest.mock('node:dns', () => ({
  setDefaultResultOrder: jest.fn(),
}));

jest.mock('node:net', () => ({
  setDefaultAutoSelectFamily: jest.fn(),
}));

describe('applyDatabaseDnsDefaults', () => {
  const originalOrder = process.env.DB_DNS_RESULT_ORDER;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    if (originalOrder === undefined) {
      delete process.env.DB_DNS_RESULT_ORDER;
    } else {
      process.env.DB_DNS_RESULT_ORDER = originalOrder;
    }
  });

  it('applies ipv4first by default', () => {
    delete process.env.DB_DNS_RESULT_ORDER;
    applyDatabaseDnsDefaults();
    expect(setDefaultResultOrder).toHaveBeenCalledWith('ipv4first');
  });

  it('respects DB_DNS_RESULT_ORDER=verbatim', () => {
    process.env.DB_DNS_RESULT_ORDER = 'verbatim';
    applyDatabaseDnsDefaults();
    expect(setDefaultResultOrder).toHaveBeenCalledWith('verbatim');
  });
});
