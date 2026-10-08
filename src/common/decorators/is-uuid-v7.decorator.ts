import { IsUUID, ValidationOptions } from 'class-validator';

export function IsUuidV7(
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return IsUUID('7', validationOptions);
}
