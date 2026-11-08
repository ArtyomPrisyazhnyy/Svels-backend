import { parseIikoWebhookPayload } from './iiko-webhook.util';

describe('parseIikoWebhookPayload', () => {
  it('parses delivery order update payload', () => {
    const result = parseIikoWebhookPayload({
      eventType: 'DeliveryOrderUpdate',
      organizationId: 'org-1',
      order: { id: 'order-1', status: 'CookingStarted' },
    });

    expect(result.accepted).toBe(true);
    expect(result.event?.kind).toBe('delivery_order_update');
    expect(result.event?.posOrderId).toBe('order-1');
  });
});
