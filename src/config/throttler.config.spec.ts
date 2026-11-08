describe('throttler storage env', () => {
  it('enables redis storage only when THROTTLER_STORAGE=redis', () => {
    const useRedisStorage = (): boolean =>
      process.env.THROTTLER_STORAGE === 'redis';

    const original = process.env.THROTTLER_STORAGE;
    delete process.env.THROTTLER_STORAGE;
    expect(useRedisStorage()).toBe(false);

    process.env.THROTTLER_STORAGE = 'redis';
    expect(useRedisStorage()).toBe(true);

    process.env.THROTTLER_STORAGE = original;
  });
});
