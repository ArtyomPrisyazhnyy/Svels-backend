import {
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import {
  DECOR_ICON_KINDS,
  DECOR_OBJECT_TYPES,
  DECOR_SHAPE_KINDS,
  type DecorIconKind,
  type DecorLayoutData,
  type DecorObject,
} from '../entities/decor-layout-data.type';

type Plain<T> = T & { [k: string]: unknown };

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((v) => typeof v === 'number' && Number.isFinite(v));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function isHexColor(value: unknown): boolean {
  return typeof value === 'string' && /^#([0-9a-fA-F]{3,8})$/.test(value);
}

const ALLOWED_DECOR_TYPES = new Set<string>(DECOR_OBJECT_TYPES);
const ALLOWED_SHAPE_KINDS = new Set<string>(DECOR_SHAPE_KINDS);
const ALLOWED_ICON_KINDS = new Set<string>(DECOR_ICON_KINDS as readonly string[]);

function validateDecorObject(raw: unknown): string | null {
  if (!isObject(raw)) return 'объект декора должен быть объектом';
  const obj = raw as Plain<DecorObject>;

  if (!isString(obj.id)) return 'id обязателен';
  if (!ALLOWED_DECOR_TYPES.has(obj.type)) return `неизвестный тип decor-объекта: ${String(obj.type)}`;
  if (obj.rotation !== undefined && !isFiniteNumber(obj.rotation)) return 'rotation должен числом';

  switch (obj.type) {
    case 'line':
    case 'polyline': {
      if (!isNumberArray(obj.points) || obj.points.length < 4 || obj.points.length % 2 !== 0)
        return 'points должен быть чётным массивом чисел (>= 4)';
      if (!isFiniteNumber(obj.strokeWidth)) return 'strokeWidth обязателен';
      if (!isHexColor(obj.color)) return 'color должен быть #hex';
      if (obj.type === 'polyline' && typeof obj.closed !== 'boolean')
        return 'closed должен быть boolean';
      if (obj.cornerRadius !== undefined && !isFiniteNumber(obj.cornerRadius))
        return 'cornerRadius должен числом';
      if (obj.tension !== undefined && !isFiniteNumber(obj.tension))
        return 'tension должен числом';
      return null;
    }
    case 'zone': {
      if (!isNumberArray(obj.points) || obj.points.length < 6 || obj.points.length % 2 !== 0)
        return 'points зоны должен быть чётным массивом чисел (>= 6)';
      if (!isHexColor(obj.fill)) return 'fill должен быть #hex';
      if (!isHexColor(obj.stroke)) return 'stroke должен быть #hex';
      if (!isFiniteNumber(obj.strokeWidth)) return 'strokeWidth обязателен';
      if (obj.cornerRadius !== undefined && !isFiniteNumber(obj.cornerRadius))
        return 'cornerRadius должен числом';
      if (obj.tension !== undefined && !isFiniteNumber(obj.tension))
        return 'tension должен числом';
      return null;
    }
    case 'shape': {
      if (!ALLOWED_SHAPE_KINDS.has(obj.shape)) return `неизвестная shape: ${String(obj.shape)}`;
      if (!isFiniteNumber(obj.x)) return 'x обязателен';
      if (!isFiniteNumber(obj.y)) return 'y обязателен';
      if (!isFiniteNumber(obj.width)) return 'width обязателен';
      if (!isFiniteNumber(obj.height)) return 'height обязателен';
      if (!isFiniteNumber(obj.rotation)) return 'rotation обязателен';
      if (!isHexColor(obj.fill)) return 'fill должен быть #hex';
      if (!isHexColor(obj.stroke)) return 'stroke должен быть #hex';
      if (!isFiniteNumber(obj.strokeWidth)) return 'strokeWidth обязателен';
      return null;
    }
    case 'text': {
      if (!isFiniteNumber(obj.x)) return 'x обязателен';
      if (!isFiniteNumber(obj.y)) return 'y обязателен';
      if (!isFiniteNumber(obj.rotation)) return 'rotation обязателен';
      if (typeof obj.text !== 'string' || obj.text.length === 0) return 'text обязателен';
      if (!isFiniteNumber(obj.fontSize)) return 'fontSize обязателен';
      if (!isHexColor(obj.color)) return 'color должен быть #hex';
      return null;
    }
    case 'decor-icon': {
      if (!ALLOWED_ICON_KINDS.has(obj.icon)) return `неизвестная icon: ${String(obj.icon)}`;
      if (!isFiniteNumber(obj.x)) return 'x обязателен';
      if (!isFiniteNumber(obj.y)) return 'y обязателен';
      if (!isFiniteNumber(obj.rotation)) return 'rotation обязателен';
      if (!isFiniteNumber(obj.width)) return 'width обязателен';
      if (!isFiniteNumber(obj.height)) return 'height обязателен';
      if (obj.color !== undefined && !isHexColor(obj.color)) return 'color должен быть #hex';
      return null;
    }
    default:
      return 'неизвестный тип decor-объекта';
  }
}

@ValidatorConstraint({ name: 'isValidDecorObject', async: false })
export class IsValidDecorObject implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    return validateDecorObject(value) === null;
  }

  defaultMessage(arguments_: ValidationArguments): string {
    return `${arguments_.property} содержит некорректный decor-объект`;
  }
}

@ValidatorConstraint({ name: 'isValidDecorLayoutData', async: false })
export class IsValidDecorLayoutData implements ValidatorConstraintInterface {
  validate(value: unknown): boolean {
    if (!isObject(value)) return false;
    const data = value as Plain<DecorLayoutData>;
    if (!isObject(data.grid)) return false;
    if (!isFiniteNumber(data.grid.size) || data.grid.size <= 0) return false;
    if (typeof data.grid.visible !== 'boolean') return false;
    if (!isHexColor(data.grid.color)) return false;
    if (!Array.isArray(data.objects)) return false;
    for (const obj of data.objects) {
      if (validateDecorObject(obj) !== null) return false;
    }
    return true;
  }

  defaultMessage(arguments_: ValidationArguments): string {
    return `${arguments_.property} должен соответствовать DecorLayoutData { grid, objects[] }`;
  }
}

export type { DecorIconKind };
