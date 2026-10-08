import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalObjectStorage } from './local-object-storage';
import { OBJECT_STORAGE } from './storage.constants';
import { StorageService } from './storage.service';
import { YandexObjectStorage } from './yandex-object-storage';

@Global()
@Module({
  providers: [
    LocalObjectStorage,
    YandexObjectStorage,
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService, LocalObjectStorage, YandexObjectStorage],
      useFactory: (
        configService: ConfigService,
        local: LocalObjectStorage,
        yandex: YandexObjectStorage,
      ) => {
        const driver = configService.get<'local' | 'yandex'>(
          'storage.driver',
          'local',
        );
        return driver === 'yandex' ? yandex : local;
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
