import { sanitizeText } from '../../common/utils/sanitize.util';
import type { DeliveryAddressDto } from '../../pre-orders/dto/pre-order.dto';

export function normalizeOptionalAddressField(
  value?: string | null,
): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }
  return sanitizeText(trimmed);
}

export function normalizeRequiredAddressField(value: string): string {
  return sanitizeText(value.trim());
}

/** Pre-sanitized order snapshot: trim only (no second sanitizeText pass). */
export function trimOptionalSnapshotField(
  value?: string | null,
): string | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function trimRequiredSnapshotField(value: string): string {
  return value.trim();
}

export function addressDedupeKey(
  street: string,
  house: string,
  apartment: string | null,
): string {
  const normalizePart = (part: string) =>
    part.toLowerCase().replace(/\s+/g, ' ').trim();
  return [
    normalizePart(street),
    normalizePart(house),
    normalizePart(apartment ?? ''),
  ].join('\0');
}

export function snapshotFromEntity(address: {
  street: string;
  house: string;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  comment: string | null;
  lat: string | null;
  lng: string | null;
}): DeliveryAddressDto {
  const lat =
    address.lat != null && address.lat !== '' ? Number(address.lat) : undefined;
  const lng =
    address.lng != null && address.lng !== '' ? Number(address.lng) : undefined;
  return {
    street: address.street,
    house: address.house,
    apartment: address.apartment ?? undefined,
    entrance: address.entrance ?? undefined,
    floor: address.floor ?? undefined,
    intercom: address.intercom ?? undefined,
    comment: address.comment ?? undefined,
    lat: Number.isFinite(lat) ? lat : undefined,
    lng: Number.isFinite(lng) ? lng : undefined,
  };
}
