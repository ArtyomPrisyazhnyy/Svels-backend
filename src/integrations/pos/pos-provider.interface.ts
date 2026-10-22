import type {
  PosCreateOrderInput,
  PosCreateOrderResult,
  PosMenuSyncInput,
  PosMenuSyncResult,
  PosOrderStatusQuery,
  PosOrderStatusResult,
  PosStopListInput,
  PosStopListResult,
  PosWebhookHandleResult,
  PosWebhookParseResult,
} from './pos.types';

/**
 * Абстракция POS/учётной системы ресторана (iiko, r_keeper, Frontpad, Jupiter и т.д.).
 * Реализации не должны импортировать доменные сервисы заказов Svels.
 */
export interface PosProvider {
  readonly providerId: string;

  isConfigured(): boolean;

  syncMenu(input: PosMenuSyncInput): Promise<PosMenuSyncResult>;

  getStopList(input: PosStopListInput): Promise<PosStopListResult>;

  createOrder(input: PosCreateOrderInput): Promise<PosCreateOrderResult>;

  getOrderStatus(query: PosOrderStatusQuery): Promise<PosOrderStatusResult>;

  /** Разбор входящего webhook-тела без побочных эффектов. */
  parseWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): PosWebhookParseResult;

  /** Обработка webhook (в проде — обновление статуса заказа и т.д.). */
  handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<PosWebhookHandleResult>;
}
