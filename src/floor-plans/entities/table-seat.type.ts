import { SeatKind } from '../../common/enums/seat-kind.enum';

/**
 * Посадочное место (стул/диван/скамейка/табурет) — дочерний элемент стола.
 * Координаты `x`,`y` — локальные относительно стола (от его positionX/positionY
 * и с учётом поворота стола). Радиус/габариты зависят от kind.
 */
export interface TableSeat {
  id: string;
  kind: SeatKind;
  /** Локальная X относительно стола. */
  x: number;
  /** Локальная Y относительно стола. */
  y: number;
  /** Поворот места в градусах (ориентация спинки). */
  rotation?: number;
  /** Ширина места (для диванов/скамеек). null = default по kind/slots. */
  width?: number | null;
  /** Количество посадочных мест (для дивана/скамейки). */
  slots?: number;
}

export const SEAT_KINDS: readonly SeatKind[] = [
  SeatKind.CHAIR,
  SeatKind.STOOL,
  SeatKind.COUCH,
  SeatKind.BENCH,
] as const;
