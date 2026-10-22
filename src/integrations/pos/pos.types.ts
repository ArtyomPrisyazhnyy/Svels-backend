export interface PosOrganizationRef {
  id: string;
  name: string;
  raw?: Record<string, unknown>;
}

export interface PosTerminalGroupRef {
  id: string;
  organizationId: string;
  name: string;
  raw?: Record<string, unknown>;
}

export interface PosMenuSyncInput {
  organizationId: string;
  /** Внешнее меню iiko (`externalMenuId`), если используется Web External menu. */
  externalMenuId?: string;
  /** Если true — подтянуть и RMS nomenclature (`/api/1/nomenclature`). */
  includeRmsNomenclature?: boolean;
}

export interface PosMenuCategoryDraft {
  externalId: string;
  name: string;
  sortOrder?: number;
}

export interface PosMenuProductDraft {
  externalId: string;
  categoryExternalId: string | null;
  name: string;
  description?: string | null;
  price: number;
  /** UUID размера / itemSizeId во внешнем меню. */
  sizeId?: string | null;
  modifierGroupExternalIds: string[];
  isAvailable: boolean;
  raw?: Record<string, unknown>;
}

export interface PosMenuModifierGroupDraft {
  externalId: string;
  name: string;
  minAmount?: number;
  maxAmount?: number;
  required: boolean;
  items: Array<{
    externalId: string;
    name: string;
    priceDelta: number;
  }>;
}

export interface PosMenuSyncResult {
  organizationId: string;
  externalMenuId?: string;
  categories: PosMenuCategoryDraft[];
  products: PosMenuProductDraft[];
  modifierGroups: PosMenuModifierGroupDraft[];
  /** Сырой фрагмент ответа POS (для отладки / spike). */
  rawSamples?: Record<string, unknown>;
}

export interface PosStopListInput {
  organizationIds: string[];
  terminalGroupIds?: string[];
}

export interface PosStopListEntry {
  productId: string;
  balance?: number | null;
  sku?: string | null;
}

export interface PosStopListResult {
  organizationId: string;
  terminalGroupId?: string;
  items: PosStopListEntry[];
  raw?: Record<string, unknown>;
}

export type PosFulfillmentKind = 'delivery' | 'pickup';

export interface PosCreateOrderLine {
  productId: string;
  amount: number;
  modifiers?: Array<{
    productId: string;
    amount: number;
    groupId?: string;
  }>;
}

export interface PosCreateOrderInput {
  organizationId: string;
  terminalGroupId: string;
  fulfillment: PosFulfillmentKind;
  phone: string;
  customerName?: string;
  comment?: string;
  externalNumber?: string;
  items: PosCreateOrderLine[];
  deliveryAddress?: {
    line1: string;
    city?: string;
    street?: string;
    house?: string;
    flat?: string;
  };
}

export interface PosCreateOrderResult {
  posOrderId: string;
  correlationId?: string;
  creationStatus: 'created' | 'in_progress' | 'error';
  raw?: Record<string, unknown>;
}

export interface PosOrderStatusQuery {
  organizationId: string;
  posOrderIds: string[];
}

export interface PosOrderStatusResult {
  orders: Array<{
    posOrderId: string;
    status: string;
    mappedSvelsStatus?: string;
    raw?: Record<string, unknown>;
  }>;
}

export type PosWebhookEventKind =
  | 'delivery_order_update'
  | 'stop_list_update'
  | 'unknown';

export interface PosWebhookEvent {
  kind: PosWebhookEventKind;
  organizationId?: string;
  posOrderId?: string;
  payload: Record<string, unknown>;
}

export interface PosWebhookParseResult {
  accepted: boolean;
  event?: PosWebhookEvent;
  reason?: string;
}

export interface PosWebhookHandleResult {
  handled: boolean;
  event?: PosWebhookEvent;
  actions: string[];
}
