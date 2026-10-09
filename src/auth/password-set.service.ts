import { createHash, randomBytes } from 'crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PasswordSetToken } from './entities/password-set-token.entity';

export interface PasswordSetLinkDto {
  setPasswordUrl: string;
  expiresAt: string;
}

@Injectable()
export class PasswordSetService {
  constructor(
    @InjectRepository(PasswordSetToken)
    private readonly tokensRepository: Repository<PasswordSetToken>,
    private readonly configService: ConfigService,
  ) {}

  async issueForUser(
    userId: string,
  ): Promise<PasswordSetLinkDto & { token: string }> {
    await this.tokensRepository.delete({ userId, usedAt: IsNull() });

    const token = randomBytes(32).toString('base64url');
    const tokenHash = this.hashToken(token);
    const ttlHours = this.getTtlHours();
    const expiresAt = new Date(Date.now() + ttlHours * 60 * 60 * 1000);

    await this.tokensRepository.save({
      tokenHash,
      userId,
      expiresAt,
      usedAt: null,
    });

    const setPasswordUrl = this.buildSetPasswordUrl(token);

    return {
      token,
      setPasswordUrl,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async findValidTokenRecord(
    rawToken: string,
  ): Promise<PasswordSetToken | null> {
    const tokenHash = this.hashToken(rawToken.trim());
    const record = await this.tokensRepository.findOne({
      where: { tokenHash },
    });
    return record;
  }

  assertTokenUsable(record: PasswordSetToken | null): void {
    if (!record) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Ссылка недействительна',
        error: 'Unauthorized',
        code: 'INVALID_SET_PASSWORD_TOKEN',
      });
    }

    if (record.usedAt) {
      throw new ConflictException({
        statusCode: 409,
        message: 'Ссылка уже была использована',
        error: 'Conflict',
        code: 'SET_PASSWORD_TOKEN_USED',
      });
    }

    if (record.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedException({
        statusCode: 401,
        message: 'Срок действия ссылки истёк',
        error: 'Unauthorized',
        code: 'SET_PASSWORD_TOKEN_EXPIRED',
      });
    }
  }

  async markUsed(tokenHash: string): Promise<void> {
    await this.tokensRepository.update({ tokenHash }, { usedAt: new Date() });
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getTtlHours(): number {
    const raw = this.configService.get<string>('SET_PASSWORD_TTL_HOURS');
    const parsed = parseInt(raw ?? '72', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 72;
  }

  private buildSetPasswordUrl(token: string): string {
    const base =
      this.configService.get<string>('SET_PASSWORD_URL_BASE')?.trim() ??
      'http://localhost/set-password';
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}token=${encodeURIComponent(token)}`;
  }
}
