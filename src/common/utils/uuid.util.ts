import { validate, version, v7 } from 'uuid';

export function generateUuidV7(): string {
  return v7();
}

export function isUuid(value: string): boolean {
  return validate(value);
}

export function isUuidV7(value: string): boolean {
  return validate(value) && version(value) === 7;
}
