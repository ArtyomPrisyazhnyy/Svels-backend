export default () => ({
  alerts: {
    sentryWebhookSecret: process.env.SENTRY_WEBHOOK_SECRET ?? '',
    errorsTelegramBotToken: process.env.ERRORS_TELEGRAM_BOT_TOKEN ?? '',
    errorsTelegramChatId: process.env.ERRORS_TELEGRAM_CHAT_ID ?? '',
  },
});
