import { NotFoundException } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController (ask)', () => {
  const createController = (allowed: boolean) => {
    const healthService = {
      isCustomDomainAllowed: jest.fn().mockResolvedValue(allowed),
    } as unknown as HealthService;
    return new HealthController(healthService);
  };

  it('returns ok for bound custom domain', async () => {
    const controller = createController(true);
    await expect(
      controller.caddyOnDemandTlsAsk({ domain: 'cafe.example.by' }),
    ).resolves.toEqual({ ok: true });
  });

  it('returns 404 for unbound domain', async () => {
    const controller = createController(false);
    await expect(
      controller.caddyOnDemandTlsAsk({ domain: 'unknown.example.by' }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
