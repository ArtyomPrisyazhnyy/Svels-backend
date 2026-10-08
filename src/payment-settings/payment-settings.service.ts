import {
  BadRequestException,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  decryptSecret,
  encryptSecret,
  secretsEqual,
} from '../common/utils/secret-crypto.util';
import {
  PaymentSettingsResponseDto,
  RestaurantBePaidCredentials,
  UpdatePaymentSettingsDto,
} from './dto/payment-settings.dto';
import { RestaurantPaymentSettings } from './entities/restaurant-payment-settings.entity';

@Injectable()
export class PaymentSettingsService {
  constructor(
    @InjectRepository(RestaurantPaymentSettings)
    private readonly settingsRepository: Repository<RestaurantPaymentSettings>,
    private readonly configService: ConfigService,
  ) {}

  async getByRestaurant(restaurantId: string): Promise<PaymentSettingsResponseDto> {
    const settings = await this.findOrCreate(restaurantId);
    return this.toResponse(settings);
  }

  async update(
    restaurantId: string,
    dto: UpdatePaymentSettingsDto,
  ): Promise<PaymentSettingsResponseDto> {
    const settings = await this.findOrCreate(restaurantId);

    if (dto.enabled !== undefined) {
      settings.enabled = dto.enabled;
    }
    if (dto.testMode !== undefined) {
      settings.testMode = dto.testMode;
    }
    if (dto.checkoutTransactionType !== undefined) {
      settings.checkoutTransactionType = dto.checkoutTransactionType;
    }
    if (dto.autoCapture !== undefined) {
      settings.autoCapture = dto.autoCapture;
    }
    if (dto.currency !== undefined) {
      settings.currency = dto.currency;
    }

    if (dto.shopId !== undefined) {
      const nextShopId = dto.shopId?.trim() ? dto.shopId.trim() : null;
      if (nextShopId) {
        const conflict = await this.settingsRepository.findOne({
          where: { shopId: nextShopId },
        });
        if (conflict && conflict.restaurantId !== restaurantId) {
          throw new BadRequestException('Этот Shop ID уже привязан к другому заведению');
        }
      }
      settings.shopId = nextShopId;
    }

    if (dto.clearSecretKey === true) {
      settings.secretKeyEncrypted = null;
    } else if (typeof dto.secretKey === 'string' && dto.secretKey.trim()) {
      settings.secretKeyEncrypted = encryptSecret(dto.secretKey.trim());
    }

    if (settings.enabled && (!settings.shopId || !settings.secretKeyEncrypted)) {
      throw new BadRequestException(
        'Чтобы включить онлайн-оплату, укажите Shop ID и Secret Key bePaid',
      );
    }

    const saved = await this.settingsRepository.save(settings);
    return this.toResponse(saved);
  }

  /**
   * Credentials для API bePaid.
   * Приоритет: настройки заведения → fallback из .env (локальная разработка).
   */
  async resolveCredentials(restaurantId: string): Promise<RestaurantBePaidCredentials> {
    const settings = await this.findOrCreate(restaurantId);

    if (settings.shopId && settings.secretKeyEncrypted) {
      if (!settings.enabled) {
        throw new BadRequestException(
          'Онлайн-оплата bePaid выключена в настройках заведения',
        );
      }

      return {
        restaurantId,
        shopId: settings.shopId,
        secretKey: decryptSecret(settings.secretKeyEncrypted),
        testMode: settings.testMode,
        checkoutTransactionType: settings.checkoutTransactionType,
        autoCapture: settings.autoCapture,
        currency: settings.currency || 'BYN',
      };
    }

    const envShopId = this.configService.get<string>('bepaid.shopId', '').trim();
    const envSecret = this.configService.get<string>('bepaid.secretKey', '').trim();
    if (envShopId && envSecret) {
      return {
        restaurantId,
        shopId: envShopId,
        secretKey: envSecret,
        testMode: this.configService.get<boolean>('bepaid.testMode', true),
        checkoutTransactionType: this.configService.get<'authorization' | 'payment'>(
          'bepaid.checkoutTransactionType',
          'authorization',
        ),
        autoCapture: this.configService.get<boolean>('bepaid.autoCapture', false),
        currency: this.configService.get<string>('bepaid.currency', 'BYN'),
      };
    }

    throw new BadRequestException(
      'Онлайн-оплата не настроена: укажите Shop ID и Secret Key в админке заведения (Оплата / bePaid)',
    );
  }

  async findByShopId(shopId: string): Promise<RestaurantPaymentSettings | null> {
    return this.settingsRepository.findOne({ where: { shopId } });
  }

  /**
   * Проверка Basic Auth webhook: Shop ID → настройки → сравнение секрета
   * (или fallback на глобальные ключи из .env).
   */
  async verifyWebhookBasicAuth(
    authorizationHeader: string | undefined,
  ): Promise<RestaurantBePaidCredentials | null> {
    if (!authorizationHeader?.startsWith('Basic ')) {
      return null;
    }

    let decoded: string;
    try {
      decoded = Buffer.from(authorizationHeader.slice(6), 'base64').toString('utf8');
    } catch {
      return null;
    }

    const separator = decoded.indexOf(':');
    if (separator <= 0) {
      return null;
    }

    const shopId = decoded.slice(0, separator);
    const secretKey = decoded.slice(separator + 1);
    if (!shopId || !secretKey) {
      return null;
    }

    const settings = await this.findByShopId(shopId);
    if (settings?.secretKeyEncrypted) {
      try {
        const stored = decryptSecret(settings.secretKeyEncrypted);
        if (!secretsEqual(stored, secretKey)) {
          return null;
        }
      } catch {
        return null;
      }

      return {
        restaurantId: settings.restaurantId,
        shopId,
        secretKey,
        testMode: settings.testMode,
        checkoutTransactionType: settings.checkoutTransactionType,
        autoCapture: settings.autoCapture,
        currency: settings.currency || 'BYN',
      };
    }

    const envShopId = this.configService.get<string>('bepaid.shopId', '').trim();
    const envSecret = this.configService.get<string>('bepaid.secretKey', '').trim();
    if (envShopId && envSecret && shopId === envShopId && secretsEqual(envSecret, secretKey)) {
      return {
        restaurantId: '',
        shopId,
        secretKey,
        testMode: this.configService.get<boolean>('bepaid.testMode', true),
        checkoutTransactionType: this.configService.get<'authorization' | 'payment'>(
          'bepaid.checkoutTransactionType',
          'authorization',
        ),
        autoCapture: this.configService.get<boolean>('bepaid.autoCapture', false),
        currency: this.configService.get<string>('bepaid.currency', 'BYN'),
      };
    }

    return null;
  }

  private async findOrCreate(restaurantId: string): Promise<RestaurantPaymentSettings> {
    const existing = await this.settingsRepository.findOne({ where: { restaurantId } });
    if (existing) {
      return existing;
    }

    const created = this.settingsRepository.create({
      restaurantId,
      enabled: false,
      shopId: null,
      secretKeyEncrypted: null,
      testMode: true,
      checkoutTransactionType: 'authorization',
      autoCapture: false,
      currency: 'BYN',
    });
    return this.settingsRepository.save(created);
  }

  private toResponse(settings: RestaurantPaymentSettings): PaymentSettingsResponseDto {
    return {
      restaurantId: settings.restaurantId,
      enabled: settings.enabled,
      shopId: settings.shopId,
      secretKeyConfigured: Boolean(settings.secretKeyEncrypted),
      testMode: settings.testMode,
      checkoutTransactionType: settings.checkoutTransactionType,
      autoCapture: settings.autoCapture,
      currency: settings.currency,
      updatedAt: settings.updatedAt,
    };
  }
}
