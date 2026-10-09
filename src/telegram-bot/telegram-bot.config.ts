import { registerAs } from '@nestjs/config';

export const TELEGRAM_BOT_CONFIG_KEY = 'telegramBot';

export default registerAs(TELEGRAM_BOT_CONFIG_KEY, () => ({
  botToken: process.env.TELEGRAM_BOT_TOKEN ?? '',
  botUsername: process.env.TELEGRAM_BOT_USERNAME ?? '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET ?? '',
}));
