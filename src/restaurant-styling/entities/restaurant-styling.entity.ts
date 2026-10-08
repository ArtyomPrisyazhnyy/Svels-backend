import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RestaurantButtonShape } from '../../common/enums/restaurant-styling.enum';
import { RestaurantButtonVariant } from '../../common/enums/restaurant-styling.enum';
import {
  MagazineCardLayout,
  RestaurantCardStyle,
} from '../../common/enums/restaurant-styling.enum';
import { RestaurantColorTheme } from '../../common/enums/restaurant-styling.enum';
import { RestaurantCurrencyDisplay } from '../../common/enums/restaurant-styling.enum';
import { RestaurantFontFamily } from '../../common/enums/restaurant-styling.enum';
import { RestaurantFooterAccent } from '../../common/enums/restaurant-styling.enum';
import { RestaurantFooterLayout } from '../../common/enums/restaurant-styling.enum';
import { RestaurantHeaderStyle } from '../../common/enums/restaurant-styling.enum';
import { RestaurantSwitcherStyle } from '../../common/enums/restaurant-styling.enum';

@Entity('restaurant_styling')
export class RestaurantStyling {
  @PrimaryColumn('uuid')
  restaurantId: string;

  @ManyToOne('Restaurant', { createForeignKeyConstraints: false })
  @JoinColumn({ name: 'restaurantId' })
  restaurant?: unknown;

  @Column({
    type: 'enum',
    enum: RestaurantFontFamily,
    default: RestaurantFontFamily.SYSTEM,
  })
  fontFamily: RestaurantFontFamily;

  @Column({
    type: 'enum',
    enum: RestaurantColorTheme,
    default: RestaurantColorTheme.CLASSIC,
  })
  colorTheme: RestaurantColorTheme;

  @Column({
    type: 'enum',
    enum: RestaurantCurrencyDisplay,
    default: RestaurantCurrencyDisplay.BYN_GLYPH,
  })
  currencyDisplay: RestaurantCurrencyDisplay;

  @Column({
    type: 'enum',
    enum: RestaurantButtonShape,
    default: RestaurantButtonShape.ROUNDED,
  })
  buttonShape: RestaurantButtonShape;

  @Column({
    type: 'enum',
    enum: RestaurantButtonVariant,
    default: RestaurantButtonVariant.FILLED,
  })
  buttonVariant: RestaurantButtonVariant;

  @Column({
    type: 'enum',
    enum: RestaurantSwitcherStyle,
    default: RestaurantSwitcherStyle.PILL,
  })
  switcherStyle: RestaurantSwitcherStyle;

  @Column({
    type: 'enum',
    enum: RestaurantCardStyle,
    default: RestaurantCardStyle.CLASSIC,
  })
  cardStyle: RestaurantCardStyle;

  @Column({
    type: 'enum',
    enum: MagazineCardLayout,
    default: MagazineCardLayout.CONTENT_LEFT,
  })
  magazineCardLayout: MagazineCardLayout;

  @Column({ type: 'boolean', default: false })
  menuCategoryNavEnabled: boolean;

  /** Избранное (сердечки / вкладка). Выкл. — UI скрыт; мобилка без флага — без экрана в бандле. */
  @Column({ type: 'boolean', default: true })
  favoritesEnabled: boolean;

  @Column({
    type: 'enum',
    enum: RestaurantHeaderStyle,
    default: RestaurantHeaderStyle.GLASS,
  })
  headerStyle: RestaurantHeaderStyle;

  @Column({
    type: 'enum',
    enum: RestaurantFooterLayout,
    default: RestaurantFooterLayout.COLUMNS,
  })
  footerLayout: RestaurantFooterLayout;

  @Column({
    type: 'enum',
    enum: RestaurantFooterAccent,
    default: RestaurantFooterAccent.FLAT,
  })
  footerAccent: RestaurantFooterAccent;

  @UpdateDateColumn()
  updatedAt: Date;
}
