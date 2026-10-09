export function roundToKopecks(amount: number): number {
  return Math.round(amount * 100) / 100;
}
