import {
  ForbiddenException,
  HttpException,
  HttpStatus,
  NotFoundException,
} from '@nestjs/common';

export function assertGuestRestaurantAccess(
  role: string,
  userRestaurantId: string | undefined,
  restaurantId: string,
): void {
  if (role !== 'user') {
    throw new ForbiddenException({
      statusCode: HttpStatus.FORBIDDEN,
      message: 'Недостаточно прав',
      error: 'Forbidden',
      code: 'FORBIDDEN',
    });
  }
  if (!userRestaurantId || userRestaurantId !== restaurantId) {
    throw new ForbiddenException({
      statusCode: HttpStatus.FORBIDDEN,
      message: 'Нет доступа к этому заведению',
      error: 'Forbidden',
      code: 'FORBIDDEN',
    });
  }
}

export function throwAddressNotFound(): never {
  throw new NotFoundException({
    statusCode: HttpStatus.NOT_FOUND,
    message: 'Адрес не найден',
    error: 'Not Found',
    code: 'ADDRESS_NOT_FOUND',
  });
}

export function throwAddressLimit(): never {
  throw new HttpException(
    {
      statusCode: HttpStatus.CONFLICT,
      message: 'Можно сохранить не больше 10 адресов',
      error: 'Conflict',
      code: 'ADDRESS_LIMIT',
    },
    HttpStatus.CONFLICT,
  );
}
