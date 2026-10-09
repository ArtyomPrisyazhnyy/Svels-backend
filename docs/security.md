# Безопасность (Svels API)

## Секреты и production

При `NODE_ENV=production` приложение **не стартует**, если:

- `JWT_SECRET`, `BEPAY_CREDENTIALS_ENCRYPTION_KEY`, `REVALIDATE_SECRET` или эффективный `OTP_PEPPER` пустые, короче **32 символов** или совпадают с примерами из `.env.example` / дефолтами кода;
- не заданы `API_PUBLIC_URL` и `NEXT_SITE_URL`.

Генерируйте длинные случайные значения (например `openssl rand -base64 48`).

## Dev-эндпоинты

Маршруты `/dev/*` (в т.ч. `GET /dev/last-otp`) регистрируются **только** при:

- `NODE_ENV=development`
- `ENABLE_DEV_ENDPOINTS=true`

В остальных окружениях маршруты отсутствуют (ответ **404**).

## OTP

Лимиты отправки кода (ответ **429**, код `OTP_RATE_LIMITED`):

| Окно | Лимит | Ключ |
|------|-------|------|
| 60 с | 1 отправка на номер | телефон |
| 1 ч | 5 отправок на номер | телефон |
| 1 ч | 20 отправок | IP клиента |

Счётчики хранятся в Redis (если доступен), иначе in-memory в процессе API.

Проверка кода: не более **5** неверных попыток на активный код; после этого код инвалидируется (`OTP_RATE_LIMITED`).

## Rate limiting (Throttler)

Глобальный `@nestjs/throttler` с опциональным Redis-хранилищем (`THROTTLER_STORAGE=redis`). Отдельные лимиты на auth/OTP/analytics — см. `ThrottleLimits` и контроллеры.

## Установка пароля

Токен из ссылки помечается использованным атомарно (`usedAt` только если `NULL`). Повторное использование — **409** `SET_PASSWORD_TOKEN_USED`.

Базовый URL ссылки: `SET_PASSWORD_URL_BASE` (по умолчанию клиентская страница `/auth/set-password`).
