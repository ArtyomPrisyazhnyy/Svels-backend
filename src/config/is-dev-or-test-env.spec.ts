import { isDevOrTestNodeEnv } from './is-dev-or-test-env';

describe('isDevOrTestNodeEnv', () => {
  it('returns true only for development and test', () => {
    expect(isDevOrTestNodeEnv('development')).toBe(true);
    expect(isDevOrTestNodeEnv('test')).toBe(true);
  });

  it('returns false when NODE_ENV is unset or any other value', () => {
    expect(isDevOrTestNodeEnv(undefined)).toBe(false);
    expect(isDevOrTestNodeEnv('')).toBe(false);
    expect(isDevOrTestNodeEnv('production')).toBe(false);
    expect(isDevOrTestNodeEnv('staging')).toBe(false);
  });
});
