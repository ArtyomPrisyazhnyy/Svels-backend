export enum RestaurantFontFamily {
  SYSTEM = 'system',
  INTER = 'inter',
  GEORGIA = 'georgia',
  MONTSERRAT = 'montserrat',
  PLAYFAIR = 'playfair',
  GOTHIC60 = 'gothic60',
  MARMELAD = 'marmelad',
  COMFORTAA = 'comfortaa',
  COMIC_RELIEF = 'comicRelief',
  ROBOTO = 'roboto',
}

export enum RestaurantColorTheme {
  CLASSIC = 'classic',
  OCEAN = 'ocean',
  FOREST = 'forest',
  WARM = 'warm',
  BERRY = 'berry',
  LAVENDER = 'lavender',
  MIDNIGHT = 'midnight',
  EMBER = 'ember',
  OBSIDIAN = 'obsidian',
  MOSS = 'moss',
  WINE = 'wine',
  SAND = 'sand',
  CITRUS = 'citrus',
  GRAPHITE = 'graphite',
  MONOCHROME = 'monochrome',
  MONOCHROME_DARK = 'monochromeDark',
  NEON = 'neon',
}

export enum RestaurantCurrencyDisplay {
  BYN_GLYPH = 'byn_glyph',
  BYN = 'byn',
  R = 'r',
  RUB = 'rub',
}

export enum RestaurantButtonShape {
  ROUNDED = 'rounded',
  PILL = 'pill',
}

export enum RestaurantButtonVariant {
  FILLED = 'filled',
  OUTLINE = 'outline',
  SOFT = 'soft',
}

export enum RestaurantSwitcherStyle {
  PILL = 'pill',
  SEGMENTED = 'segmented',
  TABS = 'tabs',
}

export enum RestaurantCardStyle {
  CLASSIC = 'classic',
  ELEVATED = 'elevated',
  OVERLAY = 'overlay',
  MINIMAL = 'minimal',
  GLASS = 'glass',
  MAGAZINE = 'magazine',
}

/** Компоновка журнальной карточки (только при cardStyle = magazine). */
export enum MagazineCardLayout {
  /** Текст слева, фото справа — текущий вид. */
  CONTENT_LEFT = 'content_left',
  /** Фото слева, текст справа. */
  MEDIA_LEFT = 'media_left',
}

export enum RestaurantHeaderStyle {
  GLASS = 'glass',
  SOLID = 'solid',
  BORDERED = 'bordered',
}

export enum RestaurantFooterLayout {
  COLUMNS = 'columns',
  CENTERED = 'centered',
  MINIMAL = 'minimal',
}

export enum RestaurantFooterAccent {
  FLAT = 'flat',
  TINTED = 'tinted',
  TOP_BORDER = 'top-border',
}
