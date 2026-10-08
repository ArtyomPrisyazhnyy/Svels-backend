export default () => ({
  leads: {
    telegramBotToken: process.env.LEADS_TELEGRAM_BOT_TOKEN ?? '',
    telegramChatId: process.env.LEADS_TELEGRAM_CHAT_ID ?? '',
  },
});
