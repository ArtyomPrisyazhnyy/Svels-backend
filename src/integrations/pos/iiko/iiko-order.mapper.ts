import type { PosCreateOrderInput } from '../pos.types';

function formatIikoPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('375')) {
    return `+${digits}`;
  }
  if (digits.startsWith('8') && digits.length === 11) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.startsWith('7')) {
    return `+${digits}`;
  }
  return phone.startsWith('+') ? phone : `+${digits}`;
}

export function buildIikoCreateDeliveryRequest(
  input: PosCreateOrderInput,
): Record<string, unknown> {
  const phone = formatIikoPhone(input.phone);
  const orderServiceType =
    input.fulfillment === 'pickup' ? 'DeliveryByClient' : 'DeliveryByCourier';

  const order: Record<string, unknown> = {
    phone,
    orderServiceType,
    comment: input.comment,
    items: input.items.map((line) => ({
      productId: line.productId,
      type: 'Product',
      amount: line.amount,
      modifiers: (line.modifiers ?? []).map((m) => ({
        productId: m.productId,
        amount: m.amount,
        productGroupId: m.groupId ?? null,
      })),
    })),
    customer: {
      type: 'one-time',
      name: input.customerName ?? 'Svels test guest',
      phone,
    },
  };

  if (input.externalNumber) {
    order.externalNumber = input.externalNumber;
  }

  if (input.fulfillment === 'delivery' && input.deliveryAddress) {
    order.deliveryPoint = {
      address: {
        type: 'legacy',
        street: {
          name: input.deliveryAddress.street ?? input.deliveryAddress.line1,
          city: input.deliveryAddress.city,
        },
        house: input.deliveryAddress.house,
        flat: input.deliveryAddress.flat,
      },
    };
  }

  return {
    organizationId: input.organizationId,
    terminalGroupId: input.terminalGroupId,
    order,
  };
}

const IIKO_TO_SVELS_STATUS: Record<string, string> = {
  Unconfirmed: 'new',
  WaitCooking: 'accepted',
  ReadyForCooking: 'accepted',
  CookingStarted: 'preparing',
  CookingCompleted: 'ready',
  Waiting: 'ready',
  OnWay: 'ready',
  Delivered: 'completed',
  Closed: 'completed',
  Cancelled: 'cancelled',
};

export function mapIikoDeliveryStatusToSvels(
  iikoStatus: string | undefined,
): string | undefined {
  if (!iikoStatus) {
    return undefined;
  }
  return IIKO_TO_SVELS_STATUS[iikoStatus] ?? undefined;
}
