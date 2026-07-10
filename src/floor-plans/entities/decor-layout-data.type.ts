/**
 * JSON-схема не-бронируемых объектов зоны (стены, ломаные, зоны-полигоны, декор, текст, сетка).
 * Хранится в `floor_plans.decorData`. Геометрия столов — в отдельных столбцах `tables`.
 */
export type DecorIconKind =
  | 'plant'
  | 'tv'
  | 'lamp'
  | 'curtain'
  | 'stairs'
  | 'entrance'
  | 'wc'
  | 'stage'
  | 'bar'
  | 'kitchen';

interface BaseDecorObject {
  id: string;
  rotation?: number;
}

export interface LineDecorObject extends BaseDecorObject {
  type: 'line';
  points: number[]; // [x1, y1, x2, y2, ...]
  strokeWidth: number;
  color: string;
}

export interface PolylineDecorObject extends BaseDecorObject {
  type: 'polyline';
  points: number[];
  strokeWidth: number;
  color: string;
  closed: boolean;
  cornerRadius?: number; // скругление углов между сегментами (Path с дугами)
  tension?: number; // 0 — прямые сегменты, >0 — сглаживание сплайном (Konva tension)
}

export interface ZoneDecorObject extends BaseDecorObject {
  type: 'zone';
  points: number[]; // замкнутый многоугольник
  fill: string;
  stroke: string;
  strokeWidth: number;
  cornerRadius?: number;
  tension?: number;
}

export type ShapeKind = 'rect' | 'circle' | 'triangle' | 'oval';

export interface ShapeDecorObject extends BaseDecorObject {
  type: 'shape';
  shape: ShapeKind;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  fill: string;
  stroke: string;
  strokeWidth: number;
}

export interface TextDecorObject extends BaseDecorObject {
  type: 'text';
  x: number;
  y: number;
  rotation: number;
  text: string;
  fontSize: number;
  color: string;
}

export interface DecorIconObject extends BaseDecorObject {
  type: 'decor-icon';
  x: number;
  y: number;
  rotation: number;
  icon: DecorIconKind;
  width: number;
  height: number;
  color?: string;
}

export type DecorObject =
  | LineDecorObject
  | PolylineDecorObject
  | ZoneDecorObject
  | ShapeDecorObject
  | TextDecorObject
  | DecorIconObject;

export interface DecorGrid {
  size: number;
  visible: boolean;
  color: string;
}

export interface DecorLayoutData {
  grid: DecorGrid;
  objects: DecorObject[];
}

export const DECOR_OBJECT_TYPES = [
  'line',
  'polyline',
  'zone',
  'shape',
  'text',
  'decor-icon',
] as const;

export const DECOR_SHAPE_KINDS = ['rect', 'circle', 'triangle', 'oval'] as const;

export const DECOR_ICON_KINDS: readonly DecorIconKind[] = [
  'plant',
  'tv',
  'lamp',
  'curtain',
  'stairs',
  'entrance',
  'wc',
  'stage',
  'bar',
  'kitchen',
] as const;
