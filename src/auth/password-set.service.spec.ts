import { PasswordSetService } from './password-set.service';
import { ConfigService } from '@nestjs/config';

describe('PasswordSetService.claimToken', () => {
  it('returns true when update affects a row', async () => {
    const execute = jest.fn().mockResolvedValue({ affected: 1 });
    const tokensRepository = {
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute,
      }),
    };

    const config = {
      get: (key: string, fallback?: unknown) => {
        if (key === 'setPassword.urlBase') {
          return 'https://app.test/auth/set-password';
        }
        if (key === 'setPassword.ttlHours') {
          return 24;
        }
        return fallback;
      },
    } as unknown as ConfigService;

    const service = new PasswordSetService(tokensRepository as never, config);

    await expect(service.claimToken('hash')).resolves.toBe(true);
    expect(execute).toHaveBeenCalled();
  });
});
