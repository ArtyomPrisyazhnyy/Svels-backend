import { ModifierSelectionType } from '../../common/enums/modifier-selection-type.enum';
import type { MenuItem } from '../../menu/entities/menu-item.entity';
import type { MenuModifierGroup } from '../../menu/types/menu-modifier.types';
import type { PreOrderItemModifierSnapshot } from '../types/pre-order-item-modifier.types';
import { roundToKopecks } from './round-money.util';

export type MenuItemPricingErrorCode = 'ITEM_UNAVAILABLE' | 'INVALID_MODIFIERS';

export class MenuItemPricingError extends Error {
  constructor(public readonly code: MenuItemPricingErrorCode) {
    super(code);
  }
}

function resolveGroupKey(group: MenuModifierGroup, index: number): string {
  return group.id ?? `group-${index}`;
}

export function resolveMenuItemLine(
  menuItem: MenuItem | undefined,
  modifierSelections: Record<string, string[]> | undefined,
): {
  unitPrice: number;
  name: string;
  modifiers: PreOrderItemModifierSnapshot[];
} {
  if (!menuItem || !menuItem.isAvailable) {
    throw new MenuItemPricingError('ITEM_UNAVAILABLE');
  }

  const groups = menuItem.modifierGroups ?? [];
  const selections = modifierSelections ?? {};
  const modifiers: PreOrderItemModifierSnapshot[] = [];
  let unitPrice = Number(menuItem.price);

  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const key = resolveGroupKey(group, index);
    const selectedOptionIds = selections[key] ?? [];

    if (group.selectionType === ModifierSelectionType.SINGLE) {
      if (selectedOptionIds.length > 1) {
        throw new MenuItemPricingError('INVALID_MODIFIERS');
      }
      if (selectedOptionIds.length === 0) {
        if (group.required) {
          throw new MenuItemPricingError('INVALID_MODIFIERS');
        }
        continue;
      }
      const option = group.options.find((o) => o.id === selectedOptionIds[0]);
      if (!option) {
        throw new MenuItemPricingError('INVALID_MODIFIERS');
      }
      unitPrice += Number(option.priceDelta);
      modifiers.push({
        groupName: group.name,
        optionName: option.name,
        priceDelta: Number(option.priceDelta),
      });
      continue;
    }

    if (selectedOptionIds.length === 0) {
      if (group.required) {
        throw new MenuItemPricingError('INVALID_MODIFIERS');
      }
      continue;
    }

    const uniqueIds = [...new Set(selectedOptionIds)];
    if (uniqueIds.length !== selectedOptionIds.length) {
      throw new MenuItemPricingError('INVALID_MODIFIERS');
    }

    for (const optionId of uniqueIds) {
      const option = group.options.find((o) => o.id === optionId);
      if (!option) {
        throw new MenuItemPricingError('INVALID_MODIFIERS');
      }
      unitPrice += Number(option.priceDelta);
      modifiers.push({
        groupName: group.name,
        optionName: option.name,
        priceDelta: Number(option.priceDelta),
      });
    }
  }

  const knownKeys = new Set(groups.map((g, i) => resolveGroupKey(g, i)));
  for (const key of Object.keys(selections)) {
    if (!knownKeys.has(key) && (selections[key]?.length ?? 0) > 0) {
      throw new MenuItemPricingError('INVALID_MODIFIERS');
    }
  }

  unitPrice = roundToKopecks(unitPrice);

  return {
    unitPrice,
    name: menuItem.name,
    modifiers,
  };
}
