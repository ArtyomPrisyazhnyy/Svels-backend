export default () => ({
  bepaid: {
    /** Опциональный fallback для локальной разработки (приоритет — админка заведения). */
    shopId: process.env.BEPAY_SHOP_ID ?? '',
    secretKey: process.env.BEPAY_SECRET_KEY ?? '',
    /** Публичный RSA-ключ магазина (для проверки Content-Signature webhook), опционально. */
    publicKey: process.env.BEPAY_PUBLIC_KEY ?? '',
    checkoutUrl: process.env.BEPAY_CHECKOUT_URL ?? 'https://checkout.bepaid.by',
    gatewayUrl: process.env.BEPAY_GATEWAY_URL ?? 'https://gateway.bepaid.by',
    currency: process.env.BEPAY_CURRENCY ?? 'BYN',
    /** true — песочница, деньги не списываются реально. */
    testMode: (process.env.BEPAY_TEST_MODE ?? 'true') === 'true',
    /**
     * authorization — холд при оплате из корзины;
     * payment — сразу списание.
     */
    checkoutTransactionType: (process.env.BEPAY_CHECKOUT_TRANSACTION_TYPE ??
      'authorization') as 'authorization' | 'payment',
    /**
     * После холда сразу capture.
     * По умолчанию false: деньги только резервируются.
     */
    autoCapture: (process.env.BEPAY_AUTO_CAPTURE ?? 'false') === 'true',
    /**
     * Публичный URL backend для webhook (ngrok в локалке).
     * Если пусто — берём API_PUBLIC_URL + /payments/bepaid/webhook.
     */
    notificationUrl: process.env.BEPAY_NOTIFICATION_URL ?? '',
    apiPublicUrl: process.env.API_PUBLIC_URL ?? 'http://127.0.0.1:3000',
    siteUrl: process.env.NEXT_SITE_URL ?? 'http://localhost:3001',
  },
});
