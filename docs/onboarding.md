# Онбординг заведений (W2-B-ONB)

Суперадмин создаёт заведение и владельца; владелец получает одноразовую ссылку на установку пароля.

## Переменные окружения

| Переменная | Описание | По умолчанию |
|------------|----------|--------------|
| `SET_PASSWORD_URL_BASE` | База URL страницы установки пароля | `http://localhost/set-password` |
| `SET_PASSWORD_TTL_HOURS` | Срок жизни ссылки (часы) | `72` |

Токен передаётся query-параметром `token`. В БД хранится только SHA-256 хэш.

## API (суперадмин)

- `GET /restaurants/admin/all?search=` — список заведений с email владельца
- `POST /restaurants/admin/create` — создание заведения и владельца
- `POST /restaurants/admin/:id/owner-invite` — повторная ссылка на установку пароля

## Установка пароля

- `POST /auth/set-password` — body `{ token, password }` (пароль ≥ 8 символов), ответ как у `login`

Коды ошибок: `INVALID_SET_PASSWORD_TOKEN`, `SET_PASSWORD_TOKEN_EXPIRED`, `SET_PASSWORD_TOKEN_USED`.

## Меню

- `PATCH /restaurants/:restaurantId/menu/categories/:categoryId`
- `DELETE /restaurants/:restaurantId/menu/categories/:categoryId` — `409 CATEGORY_NOT_EMPTY`, если есть позиции
- `PUT /restaurants/:restaurantId/menu/categories/order` — body `{ ids: string[] }`

## Юридические реквизиты

Поля `legalName`, `legalAddress`, `contactPhone`, `contactEmail`, `unp` в `GET /restaurants/:id` и `PATCH /restaurants/:id` (право `MANAGE_RESTAURANT`).
