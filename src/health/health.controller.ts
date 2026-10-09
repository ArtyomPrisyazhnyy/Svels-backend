import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  NotFoundException,
  Query,
} from '@nestjs/common';
import { CaddyAskQueryDto } from './dto/caddy-ask-query.dto';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('ask')
  async caddyOnDemandTlsAsk(@Query() query: CaddyAskQueryDto) {
    const allowed = await this.healthService.isCustomDomainAllowed(
      query.domain,
    );
    if (!allowed) {
      throw new NotFoundException();
    }
    return { ok: true };
  }

  @Get('health')
  async getHealth() {
    const result = await this.healthService.check();
    if (result.db !== 'up') {
      throw new HttpException(result, HttpStatus.SERVICE_UNAVAILABLE);
    }
    return result;
  }
}
