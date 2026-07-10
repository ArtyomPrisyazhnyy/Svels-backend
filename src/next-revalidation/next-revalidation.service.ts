import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class NextRevalidationService {
  private readonly logger = new Logger(NextRevalidationService.name);

  constructor(private readonly configService: ConfigService) {}

  async revalidateRestaurantPublicPage(restaurantId: string): Promise<void> {
    const secret = this.configService.get<string>('nextSite.revalidateSecret');
    const siteUrl = this.configService.get<string>('nextSite.url');

    if (!secret || !siteUrl) {
      this.logger.debug(
        'Пропуск revalidation Next.js: задайте REVALIDATE_SECRET и NEXT_SITE_URL в .env',
      );
      return;
    }

    try {
      const response = await fetch(`${siteUrl}/api/revalidate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${secret}`,
        },
        body: JSON.stringify({ restaurantId }),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        this.logger.warn(
          `Next.js revalidation failed (${response.status}) for ${restaurantId}: ${body}`,
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'unknown error';
      this.logger.warn(`Next.js revalidation error for ${restaurantId}: ${message}`);
    }
  }
}
