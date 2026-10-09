import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UuidV7Subscriber } from './uuid-v7.subscriber';
import { resolvePostgresConnection } from './pg-connection';
import type { TlsOptions } from 'tls';

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const connection = resolvePostgresConnection();
        const ssl =
          configService.get<TlsOptions | undefined>('database.ssl') ??
          connection.ssl;

        return {
          type: 'postgres' as const,
          ...(connection.url
            ? { url: connection.url }
            : {
                host: connection.host,
                port: connection.port,
                username: connection.username,
                password: connection.password,
                database: connection.database,
              }),
          ssl,
          extra: {
            connectionTimeoutMillis: 20_000,
          },
          autoLoadEntities: true,
          synchronize: process.env.DB_SYNC === 'true',
          migrations: ['dist/database/migrations/*.js'],
          migrationsRun: false,
          logging: configService.get<string>('nodeEnv') === 'development',
          subscribers: [UuidV7Subscriber],
        };
      },
    }),
  ],
})
export class DatabaseModule {}
