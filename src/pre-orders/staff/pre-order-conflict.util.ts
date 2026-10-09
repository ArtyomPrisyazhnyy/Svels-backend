import { ConflictException, HttpException, HttpStatus } from '@nestjs/common';

export function throwPreOrderConflict(code: string, message: string): never {
  throw new HttpException(
    {
      statusCode: HttpStatus.CONFLICT,
      message,
      error: 'Conflict',
      code,
    },
    HttpStatus.CONFLICT,
  );
}

export function throwInvalidTransition(
  message = 'Недопустимый переход статуса',
): never {
  throwPreOrderConflict('INVALID_TRANSITION', message);
}

export function throwPaidOrderCancelNotSupported(): never {
  throw new ConflictException({
    statusCode: HttpStatus.CONFLICT,
    message: 'Отмена оплаченного заказа пока не поддерживается',
    error: 'Conflict',
    code: 'PAID_ORDER_CANCEL_NOT_SUPPORTED',
  });
}

export function throwOrderNumberConflict(): never {
  throwPreOrderConflict(
    'ORDER_NUMBER_CONFLICT',
    'Не удалось присвоить номер заказа, попробуйте снова',
  );
}
