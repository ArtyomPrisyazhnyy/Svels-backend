import { ModifierSelectionType } from '../../common/enums/modifier-selection-type.enum';
import type { MenuItem } from '../../menu/entities/menu-item.entity';
import {
  MenuItemPricingError,
  resolveMenuItemLine,
} from './menu-item-line.util';

function makeMenuItem(
  overrides: Partial<MenuItem> & {
    modifierGroups?: MenuItem['modifierGroups'];
  },
): MenuItem {
  return {
    id: '019efb61-5d8e-7058-b838-6f2696cb4201',
    restaurantId: '019efb61-5d8e-7058-b838-6f2696cb4204',
    categoryId: '019efb61-5d8e-7058-b838-6f2696cb4205',
    name: 'Бургер',
    variantLabel: null,
    description: null,
    ingredients: null,
    nutrition: null,
    price: 10,
    oldPrice: null,
    isAvailable: true,
    imageUrl: 'x',
    imageWebpUrl: null,
    galleryUrls: [],
    galleryWebpUrls: [],
    modifierGroups: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('resolveMenuItemLine', () => {
  it('sums base price and modifier deltas', () => {
    const menuItem = makeMenuItem({
      modifierGroups: [
        {
          id: 'grp-1',
          name: 'Соус',
          selectionType: ModifierSelectionType.SINGLE,
          required: true,
          options: [
            { id: 'opt-1', name: 'Сырный', priceDelta: 2 },
            { id: 'opt-2', name: 'Чесночный', priceDelta: 1.5 },
          ],
        },
      ],
    });

    const result = resolveMenuItemLine(menuItem, { 'grp-1': ['opt-1'] });

    expect(result.unitPrice).toBe(12);
    expect(result.modifiers).toEqual([
      { groupName: 'Соус', optionName: 'Сырный', priceDelta: 2 },
    ]);
  });

  it('throws ITEM_UNAVAILABLE when item missing or not available', () => {
    expect(() => resolveMenuItemLine(undefined, {})).toThrow(
      MenuItemPricingError,
    );
    expect(() =>
      resolveMenuItemLine(makeMenuItem({ isAvailable: false }), {}),
    ).toThrow(MenuItemPricingError);
  });

  it('throws INVALID_MODIFIERS for required group without selection', () => {
    const menuItem = makeMenuItem({
      modifierGroups: [
        {
          id: 'grp-1',
          name: 'Соус',
          selectionType: ModifierSelectionType.SINGLE,
          required: true,
          options: [{ id: 'opt-1', name: 'Сырный', priceDelta: 0 }],
        },
      ],
    });

    expect(() => resolveMenuItemLine(menuItem, {})).toThrow(
      MenuItemPricingError,
    );
  });

  it('throws INVALID_MODIFIERS for single choice with two options', () => {
    const menuItem = makeMenuItem({
      modifierGroups: [
        {
          id: 'grp-1',
          name: 'Соус',
          selectionType: ModifierSelectionType.SINGLE,
          required: false,
          options: [
            { id: 'opt-1', name: 'A', priceDelta: 0 },
            { id: 'opt-2', name: 'B', priceDelta: 0 },
          ],
        },
      ],
    });

    expect(() =>
      resolveMenuItemLine(menuItem, { 'grp-1': ['opt-1', 'opt-2'] }),
    ).toThrow(MenuItemPricingError);
  });

  it('throws INVALID_MODIFIERS for unknown option', () => {
    const menuItem = makeMenuItem({
      modifierGroups: [
        {
          id: 'grp-1',
          name: 'Соус',
          selectionType: ModifierSelectionType.SINGLE,
          required: false,
          options: [{ id: 'opt-1', name: 'Сырный', priceDelta: 0 }],
        },
      ],
    });

    expect(() =>
      resolveMenuItemLine(menuItem, { 'grp-1': ['missing'] }),
    ).toThrow(MenuItemPricingError);
  });

  it('rounds unit price to kopecks', () => {
    const menuItem = makeMenuItem({
      price: 10.333,
      modifierGroups: [
        {
          id: 'grp-1',
          name: 'Доп',
          selectionType: ModifierSelectionType.MULTIPLE,
          required: false,
          options: [{ id: 'opt-1', name: 'X', priceDelta: 0.334 }],
        },
      ],
    });
    const result = resolveMenuItemLine(menuItem, { 'grp-1': ['opt-1'] });
    expect(result.unitPrice).toBe(10.67);
  });
});
