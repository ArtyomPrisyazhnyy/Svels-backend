# Telegram Mini App: вход гостя

Гость открывает Mini App заведения в Telegram. Клиент отправляет строку `Telegram.WebApp.initData`, бэкенд проверяет подпись и возвращает тот же `AuthResponseDto`, что и OTP-вход.

**Эндпоинт:** `POST /restaurants/:restaurantId/auth/telegram` (без JWT, `restaurantId` — UUIDv7).

**Тело:** `{ "initData": "<строка initData>" }`, не пусто, не длиннее 4096 символов.

**Ответ `200`:** `{ accessToken, user: { id, email, firstName, lastName, role, authProvider, restaurantId } }`. Роль гостя — `user`.

**Коды ошибок:**

| HTTP | code | Причина |
|---|---|---|
| 503 | `TELEGRAM_NOT_CONFIGURED` | `TELEGRAM_BOT_TOKEN` не задан |
| 401 | `TELEGRAM_INIT_DATA_INVALID` | нет `hash`, подпись не совпала, данные не парсятся |
| 401 | `TELEGRAM_INIT_DATA_EXPIRED` | `auth_date` старше 24 ч или в будущем больше чем на 60 с |
| 400 | `TELEGRAM_USER_MISSING` | нет поля `user` или в нём нет числового `id` |
| 404 / 400 | без code | заведение не найдено или не одобрено |

**Срок действия:** `initData` принимается не дольше 24 часов после `auth_date`.

**Бот:** один на платформу. Подпись проверяется токеном из `TELEGRAM_BOT_TOKEN`, токены по заведениям не хранятся.

**Гость:** связь Telegram-пользователя с гостем хранится в `telegram_guest_links` (ключ: `restaurantId` + `telegramUserId`). Телефона у гостя нет, email формируется как `tg+<restaurantId>+<telegramUserId>@telegram.svels.local`.

**Подключение в BotFather:** в настройках бота задайте Menu Button или Web App URL, указывающий на фронтенд Mini App заведения.
