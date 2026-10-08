import { BadRequestException } from '@nestjs/common';
import { ModifierSelectionType } from '../../common/enums/modifier-selection-type.enum';
import { generateUuidV7, isUuidV7 } from '../../common/utils/uuid.util';
import { sanitizeText } from '../../common/utils/sanitize.util';
import { MenuItemNutritionDto, MenuModifierGroupDto } from '../dto/menu.dto';
import type {
  MenuItemNutrition,
  MenuModifierGroup,
} from '../types/menu-modifier.types';

export function normalizeNutrition(
  nutrition?: MenuItemNutritionDto | null,
): MenuItemNutrition | null {
  if (!nutrition) {
    return null;
  }

  const hasValues =
    nutrition.calories !== undefined ||
    nutrition.protein !== undefined ||
    nutrition.fat !== undefined ||
    nutrition.carbs !== undefined;

  if (!hasValues) {
    return null;
  }

  return {
    calories: nutrition.calories,
    protein: nutrition.protein,
    fat: nutrition.fat,
    carbs: nutrition.carbs,
  };
}

export function normalizeModifierGroups(
  groups?: MenuModifierGroupDto[],
): MenuModifierGroup[] {
  if (!groups?.length) {
    return [];
  }

  return groups.map((group) => {
    if (!group.options?.length) {
      throw new BadRequestException(
        `Группа модификаторов «${group.name}» должна содержать хотя бы один вариант`,
      );
    }

    const optionNames = new Set<string>();
    const options = group.options.map((option) => {
      const name = sanitizeText(option.name);
      const normalizedName = name.toLowerCase();

      if (optionNames.has(normalizedName)) {
        throw new BadRequestException(
          `В группе «${group.name}» вариант «${name}» указан более одного раза`,
        );
      }
      optionNames.add(normalizedName);

      return {
        id: option.id && isUuidV7(option.id) ? option.id : generateUuidV7(),
        name,
        priceDelta: option.priceDelta ?? 0,
      };
    });

    return {
      id: group.id && isUuidV7(group.id) ? group.id : generateUuidV7(),
      name: sanitizeText(group.name),
      selectionType: group.selectionType,
      required:
        group.selectionType === ModifierSelectionType.SINGLE
          ? (group.required ?? true)
          : false,
      options,
    };
  });
}
