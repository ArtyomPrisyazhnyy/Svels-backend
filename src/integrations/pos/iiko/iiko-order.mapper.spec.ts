import {
  buildIikoCreateDeliveryRequest,
  mapIikoDeliveryStatusToSvels,
} from './iiko-order.mapper';

describe('iiko order mapper', () => {
  it('builds pickup order with normalized phone', () => {
    const body = buildIikoCreateDeliveryRequest({
      organizationId: 'org',
      terminalGroupId: 'tg',
      fulfillment: 'pickup',
      phone: '+375 29 000-00-01',
      items: [{ productId: 'prod-1', amount: 2 }],
    });

    expect(body.organizationId).toBe('org');
    const order = body.order as Record<string, unknown>;
    expect(order.orderServiceType).toBe('DeliveryByClient');
    expect(order.phone).toBe('+375290000001');
    expect((order.items as unknown[]).length).toBe(1);
  });

  it('maps iiko delivery statuses to Svels pre-order statuses', () => {
    expect(mapIikoDeliveryStatusToSvels('CookingStarted')).toBe('preparing');
    expect(mapIikoDeliveryStatusToSvels('Closed')).toBe('completed');
    expect(mapIikoDeliveryStatusToSvels('UnknownStatus')).toBeUndefined();
  });
});
