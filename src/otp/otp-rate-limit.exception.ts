import { HttpException, HttpStatus } from '@nestjs/common';

export function throwOtpRateLimited(message?: string): never {
  throw new HttpException(
    {
      statusCode: HttpStatus.TOO_MANY_REQUESTS,
      message: message ?? 'Слишком много запросов. Попробуйте позже',
      error: 'Too Many Requests',
      code: 'OTP_RATE_LIMITED',
    },
    HttpStatus.TOO_MANY_REQUESTS,
  );
}
