import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { generateUuidV7 } from '../common/utils/uuid.util';
import { LoyaltySettingsService } from '../loyalty-settings/loyalty-settings.service';
import { buildLoyaltyBalance } from './loyalty-balance.util';
import type { LoyaltyBalanceResponseDto } from './dto/loyalty-balance.dto';
import { GuestLoyaltyBalance } from './entities/guest-loyalty-balance.entity';
import { LoyaltyVisit } from './entities/loyalty-visit.entity';

const DAY_MS = 86_400_000;

export interface RecordVisitParams {
  restaurantId: string;
  userId: string;
  orderId: string;
  expireDays: number;
  now: Date;
}

@Injectable()
export class LoyaltyService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly loyaltySettingsService: LoyaltySettingsService,
  ) {}

  async recordVisit(params: RecordVisitParams): Promise<boolean> {
    const { restaurantId, userId, orderId, expireDays, now } = params;

    return this.dataSource.transaction(async (manager) => {
      const insertResult = await manager
        .createQueryBuilder()
        .insert()
        .into(LoyaltyVisit)
        .values({ id: generateUuidV7(), restaurantId, userId, orderId })
        .orIgnore()
        .returning(['id'])
        .execute();
      const insertedRows = insertResult.raw as unknown[];

      if (insertedRows.length === 0) {
        return false;
      }

      let balance = await manager.findOne(GuestLoyaltyBalance, {
        where: { restaurantId, userId },
        lock: { mode: 'pessimistic_write' },
      });

      if (!balance) {
        balance = new GuestLoyaltyBalance();
        balance.restaurantId = restaurantId;
        balance.userId = userId;
        balance.visits = 0;
        balance.totalVisits = 0;
        balance.lastVisitAt = null;
      }

      const seriesExpired =
        balance.lastVisitAt !== null &&
        now.getTime() - balance.lastVisitAt.getTime() > expireDays * DAY_MS;

      balance.visits = seriesExpired ? 1 : balance.visits + 1;
      balance.totalVisits += 1;
      balance.lastVisitAt = now;
      await manager.save(balance);

      return true;
    });
  }

  async getBalance(
    restaurantId: string,
    userId: string,
    now: Date = new Date(),
  ): Promise<LoyaltyBalanceResponseDto> {
    const settings =
      await this.loyaltySettingsService.getByRestaurant(restaurantId);
    const balance = await this.dataSource
      .getRepository(GuestLoyaltyBalance)
      .findOne({ where: { restaurantId, userId } });

    return { ...buildLoyaltyBalance(settings, balance, now), userId };
  }
}
