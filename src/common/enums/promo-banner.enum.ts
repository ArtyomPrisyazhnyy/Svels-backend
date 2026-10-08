export enum PromoBannerType {
  MODAL = 'modal',
  STRIP = 'strip',
}

/** Как часто показывать модальный баннер гостю. Для strip игнорируется. */
export enum PromoBannerDisplayFrequency {
  ONCE = 'once',
  EVERY_VISIT = 'every_visit',
}

/** Соотношение сторон плашки (strip). Для modal игнорируется. */
export enum PromoBannerAspectRatio {
  RATIO_4_1 = '4_1',
  RATIO_16_9 = '16_9',
}
