export const GUEST_ADDRESS_FIELD_LIMITS = {
  label: 40,
  street: 120,
  house: 20,
  apartment: 20,
  entrance: 20,
  floor: 20,
  intercom: 20,
  comment: 300,
} as const;

export type NormalizedGuestAddressFields = {
  label: string | null;
  street: string;
  house: string;
  apartment: string | null;
  entrance: string | null;
  floor: string | null;
  intercom: string | null;
  comment: string | null;
};

export function isWithinGuestAddressFieldLimits(
  fields: NormalizedGuestAddressFields,
): boolean {
  const limits = GUEST_ADDRESS_FIELD_LIMITS;
  if (fields.label != null && fields.label.length > limits.label) {
    return false;
  }
  if (fields.street.length > limits.street) {
    return false;
  }
  if (fields.house.length > limits.house) {
    return false;
  }
  if (fields.apartment != null && fields.apartment.length > limits.apartment) {
    return false;
  }
  if (fields.entrance != null && fields.entrance.length > limits.entrance) {
    return false;
  }
  if (fields.floor != null && fields.floor.length > limits.floor) {
    return false;
  }
  if (fields.intercom != null && fields.intercom.length > limits.intercom) {
    return false;
  }
  if (fields.comment != null && fields.comment.length > limits.comment) {
    return false;
  }
  return true;
}
