export class InvalidPhoneError extends Error {
  constructor() {
    super('INVALID_PHONE');
  }
}

export type PhoneCountry = 'BY' | 'RU';

/**
 * Нормализует телефон к цифрам без «+» (E.164 без плюса):
 * BY: 375XXXXXXXXX, RU: 7XXXXXXXXXX.
 */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.startsWith('375') && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith('80') && digits.length === 11) {
    return `375${digits.slice(2)}`;
  }

  // Локальный BY без кода страны: 29/25/33/44 + 7 цифр
  if (digits.length === 9 && /^[234]\d{8}$/.test(digits)) {
    return `375${digits}`;
  }

  if (digits.startsWith('7') && digits.length === 11) {
    return digits;
  }

  // РФ: 8XXXXXXXXXX → 7XXXXXXXXXX
  if (digits.startsWith('8') && digits.length === 11 && /^89\d{9}$/.test(digits)) {
    return `7${digits.slice(1)}`;
  }

  // РФ без кода: 9XXXXXXXXX
  if (digits.length === 10 && digits.startsWith('9')) {
    return `7${digits}`;
  }

  throw new InvalidPhoneError();
}

export function isValidPhone(normalized: string): boolean {
  return isBelarusPhone(normalized) || isRussiaPhone(normalized);
}

export function isBelarusPhone(normalized: string): boolean {
  return /^375(25|29|33|44)\d{7}$/.test(normalized);
}

export function isRussiaPhone(normalized: string): boolean {
  return /^7\d{10}$/.test(normalized);
}

export function getPhoneCountry(normalized: string): PhoneCountry {
  if (isBelarusPhone(normalized)) {
    return 'BY';
  }
  if (isRussiaPhone(normalized)) {
    return 'RU';
  }
  throw new InvalidPhoneError();
}

export function toE164(normalized: string): string {
  if (!isValidPhone(normalized)) {
    throw new InvalidPhoneError();
  }
  return `+${normalized}`;
}

export function formatPhoneDisplay(normalized: string): string {
  if (isBelarusPhone(normalized)) {
    return `+${normalized.slice(0, 3)} ${normalized.slice(3, 5)} ${normalized.slice(5, 8)}-${normalized.slice(8, 10)}-${normalized.slice(10)}`;
  }

  if (isRussiaPhone(normalized)) {
    return `+${normalized.slice(0, 1)} ${normalized.slice(1, 4)} ${normalized.slice(4, 7)}-${normalized.slice(7, 9)}-${normalized.slice(9)}`;
  }

  return normalized;
}

/** Маска для UI: +375 29 ***-**-67 */
export function maskPhone(normalized: string): string {
  if (isBelarusPhone(normalized)) {
    return `+${normalized.slice(0, 3)} ${normalized.slice(3, 5)} ***-**-${normalized.slice(10)}`;
  }

  if (isRussiaPhone(normalized)) {
    return `+${normalized.slice(0, 1)} ${normalized.slice(1, 4)} ***-**-${normalized.slice(9)}`;
  }

  return normalized;
}

export function buildGuestUserEmail(restaurantId: string, phone: string): string {
  return `guest+${restaurantId}+${phone}@phone.svels.local`;
}
