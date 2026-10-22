import { config } from 'dotenv';
import { IikoHttpClient } from '../src/integrations/pos/iiko/iiko-http.client';
import { IikoPosProvider } from '../src/integrations/pos/iiko/iiko-pos.provider';
import {
  readIikoPosConfigFromEnv,
  isIikoAuthConfigured,
} from '../src/integrations/pos/iiko/iiko.config';
import { IikoApiError } from '../src/integrations/pos/iiko/iiko.errors';

config();

const SPIKE_PHONE = '+375 29 000-00-01';

function summarize(value: unknown, maxLen = 1200): string {
  const json = JSON.stringify(value, null, 2);
  if (json.length <= maxLen) {
    return json;
  }
  return `${json.slice(0, maxLen)}\n... [trimmed ${json.length - maxLen} chars]`;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

async function tryLegacyDemoAuth(): Promise<void> {
  console.log(
    '\n--- Legacy demo check: POST /api/1/access_token { apiLogin: demoDelivery } ---',
  );
  const client = new IikoHttpClient({
    config: {
      ...readIikoPosConfigFromEnv(),
      enabled: true,
      apiLogin: 'demoDelivery',
      apiKey: undefined,
      appId: undefined,
      clientSecret: undefined,
    },
  });
  try {
    const token = await client.getAccessToken(true);
    console.log('OK, token prefix:', token.slice(0, 12), '...');
  } catch (error) {
    if (error instanceof IikoApiError) {
      console.log('FAILED:', error.message, error.correlationId ?? '');
      console.log(summarize(error.body));
    } else {
      console.log('FAILED:', error);
    }
  }
}

async function main(): Promise<void> {
  const envConfig = readIikoPosConfigFromEnv();
  console.log('iiko spike — base URL:', envConfig.baseUrl);
  console.log('IIKO_POS_ENABLED:', envConfig.enabled);
  console.log(
    'Auth configured:',
    isIikoAuthConfigured(envConfig),
    '(v2:',
    Boolean(envConfig.apiKey && envConfig.appId && envConfig.clientSecret),
    'v1 apiLogin:',
    Boolean(envConfig.apiLogin),
    ')',
  );

  if (!isIikoAuthConfigured(envConfig)) {
    await tryLegacyDemoAuth();
    console.log(
      '\nНет рабочих кредов для iikoCloud. Задайте IIKO_API_KEY, IIKO_APP_ID, IIKO_CLIENT_SECRET',
    );
    process.exit(1);
  }

  const http = new IikoHttpClient({
    config: { ...envConfig, enabled: true },
  });
  const provider = new IikoPosProvider(http);

  try {
    console.log('\n--- Auth ---');
    const token = await http.getAccessToken(true);
    console.log('Token acquired, prefix:', token.slice(0, 12), '...');

    console.log('\n--- Organizations ---');
    const organizations = await http.fetchOrganizations();
    console.log(summarize(organizations));
    const orgList = asArray(asRecord(organizations)?.organizations);
    const firstOrg = asRecord(orgList[0]);
    const organizationId =
      (typeof firstOrg?.id === 'string' && firstOrg.id) || undefined;
    if (!organizationId) {
      throw new Error('organizations: пустой список');
    }
    console.log('Using organizationId:', organizationId);

    console.log('\n--- Terminal groups ---');
    const terminalGroups = await http.fetchTerminalGroups([organizationId]);
    console.log(summarize(terminalGroups));
    const tgList = asArray(
      asRecord(terminalGroups)?.terminalGroups ??
        asRecord(terminalGroups)?.terminalGroup,
    );
    const firstTgContainer = asRecord(tgList[0]);
    const items = asArray(firstTgContainer?.items ?? tgList);
    const firstTg = asRecord(items[0]);
    const terminalGroupId =
      (typeof firstTg?.id === 'string' && firstTg.id) ||
      (typeof firstTg?.terminalGroupId === 'string' &&
        firstTg.terminalGroupId) ||
      undefined;
    console.log('Using terminalGroupId:', terminalGroupId ?? '(not found)');

    console.log('\n--- RMS nomenclature ---');
    const nomenclature = await http.fetchNomenclature(organizationId);
    console.log(summarize(nomenclature));

    console.log('\n--- External menus ---');
    const menus = await http.fetchExternalMenus();
    console.log(summarize(menus));

    console.log('\n--- Menu sync (mapped drafts) ---');
    const menuSync = await provider.syncMenu({
      organizationId,
      includeRmsNomenclature: false,
    });
    console.log(
      'categories:',
      menuSync.categories.length,
      'products:',
      menuSync.products.length,
      'modifierGroups:',
      menuSync.modifierGroups.length,
      'externalMenuId:',
      menuSync.externalMenuId,
    );

    console.log('\n--- Stop lists ---');
    const stopList = await provider.getStopList({
      organizationIds: [organizationId],
    });
    console.log('stop list items:', stopList.items.length);
    console.log(summarize(stopList.raw));

    const sampleProduct =
      menuSync.products.find((p) => p.isAvailable && p.price > 0) ??
      menuSync.products[0];

    if (!sampleProduct || !terminalGroupId) {
      console.log(
        '\nSkip order create: нет terminalGroupId или позиции меню для теста',
      );
      process.exit(0);
    }

    console.log('\n--- Create test pickup order ---');
    const externalNumber = `svels-spike-${Date.now()}`;
    const created = await provider.createOrder({
      organizationId,
      terminalGroupId,
      fulfillment: 'pickup',
      phone: SPIKE_PHONE,
      customerName: 'Svels Spike',
      comment: 'Svels iiko integration spike (safe test)',
      externalNumber,
      items: [{ productId: sampleProduct.externalId, amount: 1 }],
    });
    console.log(summarize(created));

    if (created.posOrderId) {
      console.log('\n--- Order status ---');
      const status = await provider.getOrderStatus({
        organizationId,
        posOrderIds: [created.posOrderId],
      });
      console.log(summarize(status));
    } else {
      console.log(
        'Order id не получен сразу; при необходимости опросите /api/1/commands/status',
        created.correlationId,
      );
    }

    console.log('\nSpike completed successfully.');
  } catch (error) {
    if (error instanceof IikoApiError) {
      console.error('iiko API error:', error.message);
      console.error(
        'status:',
        error.statusCode,
        'correlationId:',
        error.correlationId,
      );
      console.error(summarize(error.body));
    } else {
      console.error(error);
    }
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
