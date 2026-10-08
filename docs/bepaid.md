# bePaid — оплата онлайн (холд / списание / отмена)

## Где хранятся ключи

**Shop ID / Secret Key** — в админке заведения: `/restaurant-admin/payment-settings`  
(`GET|PATCH /restaurants/:id/payment-settings`). Secret Key шифруется AES-256-GCM
(`BEPAY_CREDENTIALS_ENCRYPTION_KEY` или `JWT_SECRET`) и в API не отдаётся
(только флаг `secretKeyConfigured`).

Опциональный fallback из `.env` (`BEPAY_SHOP_ID` / `BEPAY_SECRET_KEY`) — только для
локальной разработки, если у заведения ключи ещё не заданы.

## Песочница

В настройках заведения включите «Тестовый режим» (`testMode`) — в checkout уходит `"test": true`.  
Отдельный sandbox-магазин не нужен. Тестовые карты:
[docs.bepaid.by](https://docs.bepaid.by/en/integration/card_api/testing/).

| Карта              | Ожидание   |
|--------------------|------------|
| `4200000000000000` | successful |
| `4005550000000019` | failed     |

## Поток в Svels

1. Гость оформляет корзину с оплатой **онлайн** → `POST /restaurants/:id/pre-orders`.
2. Backend берёт credentials заведения и создаёт checkout (`authorization` или `payment`).
3. Редирект на `redirect_url` bePaid.
4. Return URL `/restaurants/:id/payment/result` + sync `POST /payments/:id/sync`.
5. Webhook `POST /payments/bepaid/webhook` (Basic Auth `shopId:secretKey` этого заведения).
6. По умолчанию `autoCapture=false`: остаётся холд. Capture / void — вручную после проверки заказа.

Ручное управление:

- Capture: `POST /restaurants/:restaurantId/pre-orders/:preOrderId/payments/capture`
- Void: `POST /restaurants/:restaurantId/pre-orders/:preOrderId/payments/void`

## Переменные окружения (инфраструктура)

```env
# Шифрование секретов в БД (рекомендуется отдельный ключ на проде)
# BEPAY_CREDENTIALS_ENCRYPTION_KEY=

# Опциональный fallback для локалки (иначе — только админка)
# BEPAY_SHOP_ID=
# BEPAY_SECRET_KEY=

API_PUBLIC_URL=http://127.0.0.1:3000
# BEPAY_NOTIFICATION_URL=https://xxxx.ngrok-free.app/payments/bepaid/webhook
NEXT_SITE_URL=http://localhost:3001
```

## Миграция

Dev: TypeORM `synchronize` создаст `restaurant_payment_settings` и `payments`.  
Иначе:

```bash
psql … -f scripts/add-payment-settings.sql
psql … -f scripts/add-payments.sql
```
