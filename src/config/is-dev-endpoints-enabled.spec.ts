import { isDevEndpointsEnabled } from './is-dev-endpoints-enabled';

describe('isDevEndpointsEnabled', () => {
  it('is true only for development with ENABLE_DEV_ENDPOINTS=true', () => {
    expect(isDevEndpointsEnabled('development', 'true')).toBe(true);
  });

  it('is false without flag or outside development', () => {
    expect(isDevEndpointsEnabled('development', 'false')).toBe(false);
    expect(isDevEndpointsEnabled('development', undefined)).toBe(false);
    expect(isDevEndpointsEnabled('test', 'true')).toBe(false);
    expect(isDevEndpointsEnabled('production', 'true')).toBe(false);
    expect(isDevEndpointsEnabled(undefined, 'true')).toBe(false);
  });
});
