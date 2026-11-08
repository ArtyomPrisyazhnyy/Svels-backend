import type {
  PosMenuCategoryDraft,
  PosMenuModifierGroupDraft,
  PosMenuProductDraft,
} from '../pos.types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function readNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/**
 * Упрощённый маппинг внешнего меню iiko (v2/v3) в черновики Svels.
 * Полная нормализация (размеры, nested modifiers) — в production-итерации.
 */
export function mapIikoExternalMenuToPosDrafts(menuPayload: unknown): {
  categories: PosMenuCategoryDraft[];
  products: PosMenuProductDraft[];
  modifierGroups: PosMenuModifierGroupDraft[];
} {
  const root = asRecord(menuPayload);
  const itemCategories = asArray(root?.itemCategories);
  const categories: PosMenuCategoryDraft[] = [];
  const products: PosMenuProductDraft[] = [];
  const modifierGroups: PosMenuModifierGroupDraft[] = [];
  const modifierGroupIndex = new Map<string, PosMenuModifierGroupDraft>();

  for (const catRaw of itemCategories) {
    const cat = asRecord(catRaw);
    const categoryId = readString(cat?.id) ?? readString(cat?.iikoGroupId);
    const categoryName = readString(cat?.name) ?? 'Без категории';
    if (categoryId) {
      categories.push({
        externalId: categoryId,
        name: categoryName,
        sortOrder: readNumber(cat?.order) ?? undefined,
      });
    }

    for (const itemRaw of asArray(cat?.items)) {
      const item = asRecord(itemRaw);
      const productId =
        readString(item?.itemId) ??
        readString(item?.sku) ??
        readString(item?.id);
      if (!productId) {
        continue;
      }

      const sizes = asArray(item?.itemSizes);
      const defaultSize = asRecord(sizes[0]);
      const firstPrice = asRecord(asArray(defaultSize?.prices)[0]);
      const price =
        readNumber(firstPrice?.price) ??
        readNumber(defaultSize?.price) ??
        readNumber(item?.price) ??
        0;

      const groupIds: string[] = [];
      for (const groupRaw of asArray(item?.itemModifierGroups)) {
        const group = asRecord(groupRaw);
        const groupId = readString(group?.id) ?? readString(group?.name);
        if (!groupId) {
          continue;
        }
        groupIds.push(groupId);

        if (!modifierGroupIndex.has(groupId)) {
          const minAmount = readNumber(group?.minAmount) ?? 0;
          const maxAmount = readNumber(group?.maxAmount);
          const items = asArray(group?.items).map((optRaw) => {
            const opt = asRecord(optRaw);
            const optId =
              readString(opt?.itemId) ?? readString(opt?.sku) ?? groupId;
            return {
              externalId: optId,
              name: readString(opt?.name) ?? optId,
              priceDelta: readNumber(opt?.price) ?? 0,
            };
          });

          modifierGroupIndex.set(groupId, {
            externalId: groupId,
            name: readString(group?.name) ?? groupId,
            minAmount,
            maxAmount: maxAmount ?? undefined,
            required: minAmount > 0,
            items,
          });
        }
      }

      products.push({
        externalId: productId,
        categoryExternalId: categoryId,
        name: readString(item?.name) ?? productId,
        description: readString(item?.description),
        price,
        sizeId: readString(defaultSize?.sizeId),
        modifierGroupExternalIds: groupIds,
        isAvailable: item?.isHidden !== true,
        raw: item ?? undefined,
      });
    }
  }

  modifierGroups.push(...modifierGroupIndex.values());

  return { categories, products, modifierGroups };
}

/** Черновики из RMS nomenclature (`/api/1/nomenclature`). */
export function mapIikoRmsNomenclatureToPosDrafts(payload: unknown): {
  categories: PosMenuCategoryDraft[];
  products: PosMenuProductDraft[];
} {
  const root = asRecord(payload);
  const groups = asArray(root?.groups);
  const productsRaw = asArray(root?.products);

  const categories: PosMenuCategoryDraft[] = groups
    .map((g) => asRecord(g))
    .filter((g): g is Record<string, unknown> => Boolean(g))
    .map((g) => ({
      externalId: readString(g.id) ?? '',
      name: readString(g.name) ?? 'Группа',
    }))
    .filter((c) => c.externalId);

  const products: PosMenuProductDraft[] = productsRaw
    .map((p) => asRecord(p))
    .filter((p): p is Record<string, unknown> => Boolean(p))
    .map((p) => {
      const id = readString(p.id) ?? '';
      const groupId = readString(p.parentGroup) ?? readString(p.groupId);
      const sizePrices = asArray(p.sizePrices);
      const price =
        readNumber(asRecord(sizePrices[0])?.price) ?? readNumber(p.price) ?? 0;
      return {
        externalId: id,
        categoryExternalId: groupId,
        name: readString(p.name) ?? id,
        description: readString(p.description),
        price,
        modifierGroupExternalIds: [],
        isAvailable: true,
        raw: p,
      };
    })
    .filter((p) => p.externalId);

  return { categories, products };
}
