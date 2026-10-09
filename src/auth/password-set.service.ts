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

  /**
   * Атомарно помечает токен использованным. Возвращает false, если уже использован.
   */
  async claimToken(tokenHash: string): Promise<boolean> {
    const result = await this.tokensRepository
      .createQueryBuilder()
      .update(PasswordSetToken)
      .set({ usedAt: () => 'now()' })
      .where('tokenHash = :tokenHash', { tokenHash })
      .andWhere('"usedAt" IS NULL')
      .andWhere('"expiresAt" > now()')
      .execute();

    return (result.affected ?? 0) > 0;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getTtlHours(): number {
    const configured = this.configService.get<number>('setPassword.ttlHours');
    if (typeof configured === 'number' && configured > 0) {
      return configured;
    }
    return 72;
  }

  private buildSetPasswordUrl(token: string): string {
    const base =
      this.configService.get<string>('setPassword.urlBase')?.trim() ||
      'http://localhost:3001/auth/set-password';
    const separator = base.includes('?') ? '&' : '?';
    return `${base}${separator}token=${encodeURIComponent(token)}`;
  }
}
