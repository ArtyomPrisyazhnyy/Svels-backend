/**
 * Виды посадочных мест вокруг стола (стулья/диваны/скамейки/табуреты).
 * Хранятся в `tables.seats` (JSONB) как дочерние элементы стола —
 * двигаются и вращаются вместе со столом.
 */
export enum SeatKind {
  CHAIR = 'chair',
  STOOL = 'stool',
  COUCH = 'couch',
  BENCH = 'bench',
}
