import type { PosProvider } from '../pos-provider.interface';
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
} from '../pos.types';
import { IikoHttpClient } from './iiko-http.client';
import {
  mapIikoExternalMenuToPosDrafts,
  mapIikoRmsNomenclatureToPosDrafts,
} from './iiko-menu.mapper';
import {
  buildIikoCreateDeliveryRequest,
  mapIikoDeliveryStatusToSvels,
} from './iiko-order.mapper';
import { parseIikoWebhookPayload } from './iiko-webhook.util';
import { IikoNotConfiguredError } from './iiko.errors';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function storeRawSample(
  bag: Record<string, unknown>,
  key: string,
  value: unknown,
): void {
  bag[key] = value;
}

export class IikoPosProvider implements PosProvider {
  readonly providerId = 'iiko';

  constructor(private readonly http: IikoHttpClient = new IikoHttpClient()) {}

  isConfigured(): boolean {
    return this.http.isConfigured();
  }

  private assertConfigured(): void {
    if (!this.isConfigured()) {
      throw new IikoNotConfiguredError(
        'IIKO_POS_ENABLED=true и креды (v2 или apiLogin) обязательны',
      );
    }
  }

  async syncMenu(input: PosMenuSyncInput): Promise<PosMenuSyncResult> {
    this.assertConfigured();

    const rawSamples: Record<string, unknown> = {};
    let categories: PosMenuSyncResult['categories'] = [];
    let products: PosMenuSyncResult['products'] = [];
    let modifierGroups: PosMenuSyncResult['modifierGroups'] = [];
    let externalMenuId = input.externalMenuId;

    if (input.includeRmsNomenclature) {
      const nomenclature = await this.http.fetchNomenclature(
        input.organizationId,
      );
      storeRawSample(rawSamples, 'nomenclature', nomenclature);
      const mapped = mapIikoRmsNomenclatureToPosDrafts(nomenclature);
      categories = mapped.categories;
      products = mapped.products;
    }

    if (!externalMenuId) {
      const menusResponse = await this.http.fetchExternalMenus();
      storeRawSample(rawSamples, 'externalMenus', menusResponse);
      const externalMenus = asArray(
        asRecord(menusResponse)?.externalMenus ??
          asRecord(menusResponse)?.menus,
      );
      const first = asRecord(externalMenus[0]);
      externalMenuId =
        (typeof first?.id === 'string' && first.id) ||
        (typeof first?.externalMenuId === 'string' && first.externalMenuId) ||
        undefined;
    }

    if (externalMenuId) {
      const menuById = await this.http.fetchExternalMenuById({
        externalMenuId,
        organizationIds: [input.organizationId],
        version: 3,
      });
      storeRawSample(rawSamples, 'externalMenuById', menuById);
      const mapped = mapIikoExternalMenuToPosDrafts(menuById);
      if (!input.includeRmsNomenclature) {
        categories = mapped.categories;
        products = mapped.products;
      }
      modifierGroups = mapped.modifierGroups;
    }

    return {
      organizationId: input.organizationId,
      externalMenuId,
      categories,
      products,
      modifierGroups,
      rawSamples,
    };
  }

  async getStopList(input: PosStopListInput): Promise<PosStopListResult> {
    this.assertConfigured();
    const response = await this.http.fetchStopLists(input.organizationIds);
    const root = asRecord(response);
    const terminalGroupStopLists = asArray(root?.terminalGroupStopLists);
    const firstGroup = asRecord(terminalGroupStopLists[0]);
    const items = asArray(firstGroup?.items)
      .map((row) => asRecord(row))
      .filter((row): row is Record<string, unknown> => Boolean(row))
      .map((row) => ({
        productId:
          typeof row.productId === 'string'
            ? row.productId
            : typeof row.productId === 'number'
              ? String(row.productId)
              : '',
        balance:
          typeof row.balance === 'number'
            ? row.balance
            : row.balance === null
              ? null
              : undefined,
        sku: typeof row.sku === 'string' ? row.sku : null,
      }))
      .filter((row) => row.productId);

    return {
      organizationId: input.organizationIds[0] ?? '',
      terminalGroupId:
        typeof firstGroup?.terminalGroupId === 'string'
          ? firstGroup.terminalGroupId
          : undefined,
      items,
      raw: root ?? undefined,
    };
  }

  async createOrder(input: PosCreateOrderInput): Promise<PosCreateOrderResult> {
    this.assertConfigured();
    const body = buildIikoCreateDeliveryRequest(input);
    const response = await this.http.createDelivery(body);
    const root = asRecord(response);
    const orderInfo = asRecord(root?.orderInfo) ?? asRecord(root?.order);
    const posOrderId =
      (orderInfo && typeof orderInfo.id === 'string' && orderInfo.id) ||
      (typeof root?.id === 'string' && root.id) ||
      '';

    const correlationId =
      typeof root?.correlationId === 'string' ? root.correlationId : undefined;

    let creationStatus: PosCreateOrderResult['creationStatus'] = posOrderId
      ? 'created'
      : 'in_progress';

    if (!posOrderId && correlationId) {
      const statusResponse = await this.http.fetchCommandStatus(correlationId);
      const statusRoot = asRecord(statusResponse);
      if (statusRoot?.state === 'Error') {
        creationStatus = 'error';
      }
    }

    return {
      posOrderId,
      correlationId,
      creationStatus,
      raw: root ?? undefined,
    };
  }

  async getOrderStatus(
    query: PosOrderStatusQuery,
  ): Promise<PosOrderStatusResult> {
    this.assertConfigured();
    const response = await this.http.fetchDeliveriesById(
      query.organizationId,
      query.posOrderIds,
    );
    const root = asRecord(response);
    const orders = asArray(root?.orders)
      .map((o) => asRecord(o))
      .filter((o): o is Record<string, unknown> => Boolean(o))
      .map((o) => {
        const id = typeof o.id === 'string' ? o.id : '';
        const status =
          typeof o.status === 'string'
            ? o.status
            : typeof asRecord(o.order)?.status === 'string'
              ? String(asRecord(o.order)?.status)
              : 'Unknown';
        return {
          posOrderId: id,
          status,
          mappedSvelsStatus: mapIikoDeliveryStatusToSvels(status),
          raw: o,
        };
      });

    return { orders };
  }

  parseWebhook(
    _headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): PosWebhookParseResult {
    return parseIikoWebhookPayload(body);
  }

  handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    body: unknown,
  ): Promise<PosWebhookHandleResult> {
    const parsed = this.parseWebhook(headers, body);
    if (!parsed.accepted || !parsed.event) {
      return Promise.resolve({ handled: false, actions: [] });
    }

    return Promise.resolve({
      handled: true,
      event: parsed.event,
      actions: [
        'spike_noop: в production здесь обновление pre-order по posOrderId',
      ],
    });
  }
}
