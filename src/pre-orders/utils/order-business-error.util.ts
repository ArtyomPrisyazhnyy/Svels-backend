import { HttpException, HttpStatus } from '@nestjs/common';

const STATUS_BY_CODE: Record<string, HttpStatus> = {
  VALIDATION: HttpStatus.BAD_REQUEST,
  FULFILLMENT_DISABLED: HttpStatus.BAD_REQUEST,
  PAYMENT_METHOD_DISABLED: HttpStatus.BAD_REQUEST,
  ADDRESS_REQUIRED: HttpStatus.BAD_REQUEST,
  LOCATION_REQUIRED: HttpStatus.BAD_REQUEST,
  ITEM_UNAVAILABLE: HttpStatus.BAD_REQUEST,
  INVALID_MODIFIERS: HttpStatus.BAD_REQUEST,
  INVALID_REQUESTED_AT: HttpStatus.BAD_REQUEST,
  ORDERS_PAUSED: HttpStatus.CONFLICT,
  RESTAURANT_CLOSED: HttpStatus.CONFLICT,
};

export function throwOrderBusinessError(code: string, message: string): never {
  const status = STATUS_BY_CODE[code] ?? HttpStatus.BAD_REQUEST;
  const errorName = status === HttpStatus.CONFLICT ? 'Conflict' : 'Bad Request';
  throw new HttpException(
    {
      statusCode: status,
      message,
      error: errorName,
      code,
    },
    status,
  );
}
