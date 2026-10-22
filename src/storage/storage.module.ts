import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalObjectStorage } from './local-object-storage';
import { PublicMediaUrlService } from './public-media-url.service';
import { S3ObjectStorage } from './s3-object-storage';
import { OBJECT_STORAGE } from './storage.constants';
import { StorageService } from './storage.service';

@Global()
@Module({
  providers: [
    LocalObjectStorage,
    S3ObjectStorage,
    PublicMediaUrlService,
    {
      provide: OBJECT_STORAGE,
      inject: [ConfigService, LocalObjectStorage, S3ObjectStorage],
      useFactory: (
        configService: ConfigService,
        local: LocalObjectStorage,
        s3: S3ObjectStorage,
      ) => {
        const driver = configService.get<'local' | 's3'>(
          'storage.driver',
          'local',
        );
        return driver === 's3' ? s3 : local;
      },
    },
    StorageService,
  ],
  exports: [StorageService, PublicMediaUrlService],
})
export class StorageModule {}
