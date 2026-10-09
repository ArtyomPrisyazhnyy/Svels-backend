import { Inject, Injectable, Logger } from '@nestjs/common';
import { RESTAURANTS_SERVICE } from '../constants/injection-tokens';
import type { RestaurantsDomainResolver } from '../interfaces/restaurants-domain-resolver.interface';

const CACHE_TTL_MS = 5 * 60 * 1000;

type OriginCacheEntry = {
  allowed: boolean;
  expiresAt: number;
};

@Injectable()
export class CorsOriginService {
  private readonly logger = new Logger(CorsOriginService.name);
  private readonly staticOrigins: Set<string>;
  private readonly originCache = new Map<string, OriginCacheEntry>();

  constructor(
    @Inject(RESTAURANTS_SERVICE)
    private readonly restaurantsService: RestaurantsDomainResolver,
  ) {
    this.staticOrigins = parseStaticOrigins(process.env.CORS_ALLOWED_ORIGINS);
  }

  /**
   * Fastify @fastify/cors origin callback.
   */
  validateOrigin(
    origin: string | undefined,
    callback: (err: Error | null, allow: boolean) => void,
  ): void {
    void this.isOriginAllowed(origin)
      .then((allow) => callback(null, allow))
      .catch((error: unknown) => {
        this.logger.warn(
          `CORS origin check failed: ${error instanceof Error ? error.message : String(error)}`,
        );
        callback(null, false);
      });
  }

  async isOriginAllowed(origin: string | undefined): Promise<boolean> {
    if (!origin) {
      return true;
    }

    const normalized = normalizeOrigin(origin);
    if (this.staticOrigins.has(normalized)) {
      return true;
    }

    const cached = this.originCache.get(normalized);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.allowed;
    }

    const allowed = await this.checkCustomDomainOrigin(origin);
    this.originCache.set(normalized, {
      allowed,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return allowed;
  }

  private async checkCustomDomainOrigin(origin: string): Promise<boolean> {
    let hostname: string;
    try {
      hostname = new URL(origin).hostname;
    } catch {
      return false;
    }

    try {
      await this.restaurantsService.resolveByDomain(hostname);
      return true;
    } catch {
      return false;
    }
  }
}

export function parseStaticOrigins(raw: string | undefined): Set<string> {
  if (!raw?.trim()) {
    return new Set();
  }

  return new Set(
    raw
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((origin) => normalizeOrigin(origin)),
  );
}

export function normalizeOrigin(origin: string): string {
  const trimmed = origin.trim();
  try {
    const url = new URL(trimmed);
    return url.origin;
  } catch {
    return trimmed.replace(/\/$/, '');
  }
}
