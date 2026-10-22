import { Module } from '@nestjs/common';
import { POS_PROVIDER } from './pos.tokens';
import { IikoPosProvider } from './iiko/iiko-pos.provider';
import { IikoHttpClient } from './iiko/iiko-http.client';
import { readIikoPosConfigFromEnv } from './iiko/iiko.config';

/**
 * Модуль POS-интеграций. По умолчанию выключен (`IIKO_POS_ENABLED` ≠ true).
 * Не импортируется в AppModule до готовности production-потока.
 */
@Module({
  providers: [
    {
      provide: IikoHttpClient,
      useFactory: () =>
        new IikoHttpClient({ config: readIikoPosConfigFromEnv() }),
    },
    IikoPosProvider,
    {
      provide: POS_PROVIDER,
      useExisting: IikoPosProvider,
    },
  ],
  exports: [POS_PROVIDER, IikoPosProvider, IikoHttpClient],
})
export class PosIntegrationsModule {}
