import type { PosWebhookEvent, PosWebhookParseResult } from '../pos.types';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

/**
 * iiko шлёт события на URL, настроенный через `/api/1/webhooks/update_settings`.
 * Формат тела зависит от типа подписки; здесь — минимальный разбор для spike.
 */
export function parseIikoWebhookPayload(body: unknown): PosWebhookParseResult {
  const root = asRecord(body);
  if (!root) {
    return { accepted: false, reason: 'empty_or_invalid_json' };
  }

  const eventType =
    (typeof root.eventType === 'string' && root.eventType) ||
    (typeof root.event === 'string' && root.event) ||
    undefined;

  const organizationId =
    typeof root.organizationId === 'string' ? root.organizationId : undefined;

  const orderInfo = asRecord(root.order) ?? asRecord(root.deliveryOrder);
  const posOrderId =
    (orderInfo && typeof orderInfo.id === 'string' && orderInfo.id) ||
    (typeof root.orderId === 'string' && root.orderId) ||
    undefined;

  let kind: PosWebhookEvent['kind'] = 'unknown';
  if (
    eventType?.toLowerCase().includes('delivery') ||
    eventType?.toLowerCase().includes('order')
  ) {
    kind = 'delivery_order_update';
  } else if (eventType?.toLowerCase().includes('stop')) {
    kind = 'stop_list_update';
  }

  const event: PosWebhookEvent = {
    kind,
    organizationId,
    posOrderId,
    payload: root,
  };

  return { accepted: true, event };
}
