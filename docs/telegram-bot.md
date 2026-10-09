# Telegram-бот заказов (W1-B-TG)

Бот отправляет новые заказы в привязанные чаты заведения и позволяет принять или отклонить заказ кнопками в Telegram.

## Создание бота

1. Откройте [@BotFather](https://t.me/BotFather) в Telegram.
2. Команда `/newbot` — задайте имя и username бота (например `@svels_orders_bot`).
3. Сохраните выданный **токен** — это `TELEGRAM_BOT_TOKEN`.
4. Username без `@` — `TELEGRAM_BOT_USERNAME`.

## Переменные окружения

| Переменная | Описание |
|------------|----------|
| `TELEGRAM_BOT_TOKEN` | Токен Bot API. Без него отправка отключена (warning в логе при старте). |
| `TELEGRAM_BOT_USERNAME` | Username бота для deep link привязки чата. |
| `TELEGRAM_WEBHOOK_SECRET` | Секрет для заголовка `X-Telegram-Bot-Api-Secret-Token` на `POST /telegram/webhook`. |

Пример в `.env`:

```env
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
```

## Webhook

Публичный URL API (см. `API_PUBLIC_URL`), путь: `POST /telegram/webhook`.

Установка webhook через Bot API:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d '{
    "url": "https://<your-api-host>/telegram/webhook",
    "secret_token": "<TELEGRAM_WEBHOOK_SECRET>",
    "allowed_updates": ["message", "callback_query"]
  }'
```

Проверка:

```bash
curl "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/getWebhookInfo"
```

## Привязка чата заведения

1. Владелец/управляющий: `POST /restaurants/:restaurantId/telegram/link-code` (JWT, `MANAGE_RESTAURANT`).
2. Ответ: `{ code, deepLink, expiresAt }` — код одноразовый, 15 минут.
3. Откройте `deepLink` в Telegram или отправьте боту `/start <code>`.
4. Список чатов: `GET .../telegram/chats`, отвязка: `DELETE .../telegram/chats/:id`.

## Поведение

- Событие `order.created` — сообщение во все привязанные чаты заведения с кнопками «Принять» / «Отклонить».
- Callback `o:<orderId>:accept|reject` — смена статуса через `ORDERS_STAFF_SERVICE`; чат должен быть привязан к тому же `restaurantId`.
- Событие `order.status_changed` с `actor.type !== 'telegram'` — обновление текста ранее отправленных сообщений.
