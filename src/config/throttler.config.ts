import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import Redis from 'ioredis';

const useRedisStorage = (): boolean =>
  process.env.THROTTLER_STORAGE === 'redis';

export const AppThrottlerModule = ThrottlerModule.forRootAsync({
  imports: [ConfigModule],
  inject: [ConfigService],
  useFactory: (configService: ConfigService) => {
    const throttlers = [{ ttl: 60_000, limit: 100 }];

    if (!useRedisStorage()) {
      return { throttlers };
    }

    const redis = new Redis({
      host: configService.get<string>('redis.host'),
      port: configService.get<number>('redis.port'),
      password: configService.get<string>('redis.password'),
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });

    return {
      throttlers,
      storage: new ThrottlerStorageRedisService(redis),
    };
  },
});
