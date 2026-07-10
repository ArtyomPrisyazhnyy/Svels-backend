import { IsBoolean, IsIn, IsOptional } from 'class-validator';
import {
  RestaurantButtonShape,
  RestaurantButtonVariant,
  RestaurantCardStyle,
  RestaurantColorTheme,
  RestaurantCurrencyDisplay,
  RestaurantFontFamily,
  RestaurantFooterAccent,
  RestaurantFooterLayout,
  RestaurantHeaderStyle,
  MagazineCardLayout,
  RestaurantSwitcherStyle,
} from '../../common/enums/restaurant-styling.enum';

const FONT_FAMILIES = Object.values(RestaurantFontFamily);
const COLOR_THEMES = Object.values(RestaurantColorTheme);
const CURRENCY_DISPLAYS = Object.values(RestaurantCurrencyDisplay);
const BUTTON_SHAPES = Object.values(RestaurantButtonShape);
const BUTTON_VARIANTS = Object.values(RestaurantButtonVariant);
const SWITCHER_STYLES = Object.values(RestaurantSwitcherStyle);
const CARD_STYLES = Object.values(RestaurantCardStyle);
const MAGAZINE_CARD_LAYOUTS = Object.values(MagazineCardLayout);
const HEADER_STYLES = Object.values(RestaurantHeaderStyle);
const FOOTER_LAYOUTS = Object.values(RestaurantFooterLayout);
const FOOTER_ACCENTS = Object.values(RestaurantFooterAccent);

export class UpdateRestaurantStylingDto {
  @IsOptional()
  @IsIn(FONT_FAMILIES)
  fontFamily?: RestaurantFontFamily;

  @IsOptional()
  @IsIn(COLOR_THEMES)
  colorTheme?: RestaurantColorTheme;

  @IsOptional()
  @IsIn(CURRENCY_DISPLAYS)
  currencyDisplay?: RestaurantCurrencyDisplay;

  @IsOptional()
  @IsIn(BUTTON_SHAPES)
  buttonShape?: RestaurantButtonShape;

  @IsOptional()
  @IsIn(BUTTON_VARIANTS)
  buttonVariant?: RestaurantButtonVariant;

  @IsOptional()
  @IsIn(SWITCHER_STYLES)
  switcherStyle?: RestaurantSwitcherStyle;

  @IsOptional()
  @IsIn(CARD_STYLES)
  cardStyle?: RestaurantCardStyle;

  @IsOptional()
  @IsIn(MAGAZINE_CARD_LAYOUTS)
  magazineCardLayout?: MagazineCardLayout;

  @IsOptional()
  @IsBoolean()
  menuCategoryNavEnabled?: boolean;

  @IsOptional()
  @IsIn(HEADER_STYLES)
  headerStyle?: RestaurantHeaderStyle;

  @IsOptional()
  @IsIn(FOOTER_LAYOUTS)
  footerLayout?: RestaurantFooterLayout;

  @IsOptional()
  @IsIn(FOOTER_ACCENTS)
  footerAccent?: RestaurantFooterAccent;
}

export class RestaurantStylingResponseDto {
  restaurantId: string;
  fontFamily: RestaurantFontFamily;
  colorTheme: RestaurantColorTheme;
  currencyDisplay: RestaurantCurrencyDisplay;
  buttonShape: RestaurantButtonShape;
  buttonVariant: RestaurantButtonVariant;
  switcherStyle: RestaurantSwitcherStyle;
  cardStyle: RestaurantCardStyle;
  magazineCardLayout: MagazineCardLayout;
  menuCategoryNavEnabled: boolean;
  headerStyle: RestaurantHeaderStyle;
  footerLayout: RestaurantFooterLayout;
  footerAccent: RestaurantFooterAccent;
  updatedAt: Date;
}
