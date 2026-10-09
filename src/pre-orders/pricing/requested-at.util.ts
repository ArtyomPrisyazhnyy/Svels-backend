import { throwOrderBusinessError } from '../utils/order-business-error.util';

const MIN_LEAD_MS = 10 * 60 * 1000;
const MAX_LEAD_MS = 2 * 24 * 60 * 60 * 1000;

export function parseRequestedAt(
  value: string | null | undefined,
  nowMs: number = Date.now(),
): Date | null {
  if (value === undefined || value === null) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throwOrderBusinessError(
      'INVALID_REQUESTED_AT',
      'Некорректное время заказа',
    );
  }
  const ts = date.getTime();
  const min = nowMs + MIN_LEAD_MS;
  const max = nowMs + MAX_LEAD_MS;
  if (ts < min || ts > max) {
    throwOrderBusinessError(
      'INVALID_REQUESTED_AT',
      'Время заказа вне допустимого диапазона',
    );
  }
  return date;
}

export function fulfillmentInstant(
  requestedAt: Date | null,
  now: Date = new Date(),
): Date {
  return requestedAt ?? now;
}
