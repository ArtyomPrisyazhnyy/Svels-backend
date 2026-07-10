export class InvalidPhoneError extends Error {
  constructor() {
    super('INVALID_PHONE');
  }
}

export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 9) {
    return `375${digits}`;
  }

  if (digits.startsWith('375') && digits.length === 12) {
    return digits;
  }

  if (digits.startsWith('80') && digits.length === 11) {
    return `375${digits.slice(2)}`;
  }

  throw new InvalidPhoneError();
}

export function isValidPhone(normalized: string): boolean {
  return /^375\d{9}$/.test(normalized);
}

export function formatPhoneDisplay(normalized: string): string {
  if (!isValidPhone(normalized)) {
    return normalized;
  }

  return `+${normalized.slice(0, 3)} ${normalized.slice(3, 5)} ${normalized.slice(5, 8)}-${normalized.slice(8, 10)}-${normalized.slice(10)}`;
}

export function buildGuestUserEmail(restaurantId: string, phone: string): string {
  return `guest+${restaurantId}+${phone}@phone.svels.local`;
}
