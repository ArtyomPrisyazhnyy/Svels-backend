import { ModifierSelectionType } from '../../common/enums/modifier-selection-type.enum';

export interface MenuModifierOption {
  id: string;
  name: string;
  priceDelta: number;
}

export interface MenuModifierGroup {
  id: string;
  name: string;
  selectionType: ModifierSelectionType;
  required: boolean;
  options: MenuModifierOption[];
}

export interface MenuItemNutrition {
  calories?: number;
  protein?: number;
  fat?: number;
  carbs?: number;
}
