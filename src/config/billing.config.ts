import { registerAs } from '@nestjs/config';

export default registerAs('billing', () => ({
  planSitePriceMonthlyByn: Number(process.env.BILLING_PLAN_SITE_PRICE ?? 120),
  planAppPriceMonthlyByn: Number(process.env.BILLING_PLAN_APP_PRICE ?? 150),
  planComboPriceMonthlyByn: Number(process.env.BILLING_PLAN_COMBO_PRICE ?? 250),
  gracePeriodDays: Number(process.env.BILLING_GRACE_PERIOD_DAYS ?? 7),
  payee: {
    name: process.env.BILLING_PAYEE_NAME ?? 'ООО «Свелс Платформа»',
    unp: process.env.BILLING_PAYEE_UNP ?? '000000000',
    bankName: process.env.BILLING_PAYEE_BANK ?? 'Банк-пример',
    bik: process.env.BILLING_PAYEE_BIK ?? '000000000',
    account:
      process.env.BILLING_PAYEE_ACCOUNT ?? 'BY00BANK00000000000000000000',
    phone: process.env.BILLING_PAYEE_PHONE ?? '+375 29 000-00-01',
    address: process.env.BILLING_PAYEE_ADDRESS ?? 'г. Минск, ул. Примерная, 1',
  },
}));
