import { mapIikoExternalMenuToPosDrafts } from './iiko-menu.mapper';

describe('iiko menu mapper', () => {
  it('maps external menu categories and products', () => {
    const mapped = mapIikoExternalMenuToPosDrafts({
      itemCategories: [
        {
          id: 'cat-1',
          name: 'Пицца',
          items: [
            {
              itemId: 'prod-1',
              name: 'Маргарита',
              itemSizes: [{ sizeId: 'size-s', prices: [{ price: 450 }] }],
              itemModifierGroups: [
                {
                  id: 'mg-1',
                  name: 'Добавки',
                  minAmount: 0,
                  maxAmount: 3,
                  items: [{ itemId: 'mod-1', name: 'Сыр', price: 50 }],
                },
              ],
            },
          ],
        },
      ],
    });

    expect(mapped.categories).toHaveLength(1);
    expect(mapped.products[0]).toMatchObject({
      externalId: 'prod-1',
      price: 450,
      modifierGroupExternalIds: ['mg-1'],
    });
    expect(mapped.modifierGroups[0].items[0].priceDelta).toBe(50);
  });
});
