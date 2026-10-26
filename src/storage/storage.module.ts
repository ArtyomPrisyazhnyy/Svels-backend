import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { StorageDriver } from '../config/s3-env';
import { LocalObjectStorage } from './local-object-storage';
import { S3ObjectStorage } from './s3-object-storage';
import { OBJECT_STORAGE } from './storage.constants';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    LocalObjectStorage,
    S3ObjectStorage,
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService, LocalObjectStorage, S3ObjectStorage],
      useFactory: (
        configService: ConfigService,
        local: LocalObjectStorage,
        s3: S3ObjectStorage,
      ) => {
        const driver = configService.get<StorageDriver>(
          'storage.driver',
          'local',
        );
        return driver === 's3' ? s3 : local;
      },
    },
    StorageService,
  ],
  exports: [StorageService],
})
export class StorageModule {}
