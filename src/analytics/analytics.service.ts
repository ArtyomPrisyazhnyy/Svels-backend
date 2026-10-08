import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AnalyticsQueryDto } from './dto/analytics.dto';
import { VisitStat } from './entities/visit-stat.entity';

export interface RestaurantVisitSummary {
  restaurantId: string;
  totalPageViews: number;
  uniqueVisitors: number;
}

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(VisitStat)
    private readonly visitStatRepository: Repository<VisitStat>,
  ) {}

  async trackVisit(restaurantId: string, userId?: string): Promise<void> {
    const visitDate = new Date().toISOString().split('T')[0];

    const existing = await this.visitStatRepository.findOne({
      where: {
        restaurantId,
        userId: userId ?? undefined,
        visitDate,
      },
    });

    if (existing) {
      existing.pageViews += 1;
      await this.visitStatRepository.save(existing);
      return;
    }

    const stat = this.visitStatRepository.create({
      restaurantId,
      userId: userId ?? null,
      visitDate,
      pageViews: 1,
    });

    await this.visitStatRepository.save(stat);
  }

  async getVisitSummary(
    query: AnalyticsQueryDto,
  ): Promise<RestaurantVisitSummary[]> {
    const qb = this.visitStatRepository
      .createQueryBuilder('stat')
      .select('stat.restaurantId', 'restaurantId')
      .addSelect('SUM(stat.pageViews)', 'totalPageViews')
      .addSelect('COUNT(DISTINCT stat.userId)', 'uniqueVisitors')
      .groupBy('stat.restaurantId');

    if (query.restaurantId) {
      qb.andWhere('stat.restaurantId = :restaurantId', {
        restaurantId: query.restaurantId,
      });
    }

    if (query.from) {
      qb.andWhere('stat.visitDate >= :from', { from: query.from });
    }

    if (query.to) {
      qb.andWhere('stat.visitDate <= :to', { to: query.to });
    }

    const rows = await qb.getRawMany<{
      restaurantId: string;
      totalPageViews: string;
      uniqueVisitors: string;
    }>();

    return rows.map((row) => ({
      restaurantId: row.restaurantId,
      totalPageViews: parseInt(row.totalPageViews, 10),
      uniqueVisitors: parseInt(row.uniqueVisitors, 10),
    }));
  }
}
