## 3. Межрепозиторный контракт (обе стороны пишут код по нему одновременно)

Все ошибки бизнес-логики возвращаются в стандартном теле Nest с дополнительным полем `code`:
`{ "statusCode": 409, "message": "Заведение сейчас не принимает заказы", "error": "Conflict", "code": "ORDERS_PAUSED" }`.

### 3.1 Перечисления и статусы
```ts
type FulfillmentType = 'delivery' | 'takeaway' | 'dine_in';
type PreOrderPaymentMethod = 'cash' | 'card' | 'online';               // без изменений
type PreOrderStatus = 'new' | 'accepted' | 'preparing' | 'ready' | 'completed' | 'cancelled';
type OrderPaymentStatus = 'not_required' | 'pending' | 'authorized' | 'paid' | 'voided' | 'failed';
```
Миграция существующих строк (W0-B2): `pending|confirmed|paid → status='new'`, `cancelled → 'cancelled'`. `paymentStatus`: если `paymentMethod != online` → `not_required`, иначе `pending → pending`, `confirmed → authorized`, `paid → paid`, `cancelled → voided`.

**Переходы статусов** (реализует W1-B-ORD; клиент показывает только допустимые кнопки):

| Из | В | Кто может |
|---|---|---|
| new | accepted, cancelled | admin, manager, hall, telegram |
| accepted | preparing, ready, cancelled | admin, manager, hall; production → только preparing/ready |
| preparing | ready, cancelled | admin, manager, hall; production → только ready |
| ready | completed, cancelled | admin, manager, hall |
| completed, cancelled | — | — |

- `cancelled` требует `cancelReason` (1–300 символов).
- При переходе в `accepted` и `paymentStatus='authorized'` выполняется capture (существующий `PaymentsService.captureByPreOrder`). При `cancelled` и `authorized` выполняется void.
- Отмена заказа с `paymentStatus='paid'` → `409 PAID_ORDER_CANCEL_NOT_SUPPORTED` (возвраты — Wave 3).
- Недопустимый переход → `400 INVALID_TRANSITION`.

### 3.2 Гость: создание заказа — `POST /restaurants/:restaurantId/pre-orders` (JWT гостя, как сейчас)
```ts
interface CreatePreOrderPayload {
  fulfillmentType: FulfillmentType;
  paymentMethod: PreOrderPaymentMethod;
  items: Array<{
    menuItemId: string;                       // UUIDv7
    quantity: number;                         // 1..99
    modifierSelections?: Record<string, string[]>; // ключ = group.id ?? `group-${index}`, значение = option.id[] (как ModifierSelections в client/mobile)
  }>;
  customerName: string;                       // 1..120
  customerPhone: string;                      // нормализуется normalizePhone
  locationId?: string;                        // точка самовывоза/зала; обязательна для takeaway|dine_in, если у заведения >1 точки
  deliveryAddress?: {                         // обязательно для delivery
    street: string; house: string;            // 1..120 / 1..20
    apartment?: string; entrance?: string; floor?: string; intercom?: string; // ≤20
    comment?: string;                         // ≤300
  };
  requestedAt?: string | null;                // ISO 8601; null или нет = «как можно скорее»; не раньше now+10 мин и не позже now+7 дней
  recipientName?: string;                     // только delivery + orderSettings.deliveryForSomeoneElse
  recipientPhone?: string;
  comment?: string;                           // ≤1000
  bookingId?: string;
}
```
- **Убираются из запроса:** `unitPrice` и `name` у позиций. Цена и название считаются только на сервере (W1-B-ORD). W0-B2 оставляет их в DTO как `@IsOptional` и **игнорирует**, чтобы старые клиенты не ломались.
- Ошибки: `400 VALIDATION` (стандартная валидация), `400 FULFILLMENT_DISABLED`, `400 PAYMENT_METHOD_DISABLED`, `400 ADDRESS_REQUIRED`, `400 LOCATION_REQUIRED`, `400 ITEM_UNAVAILABLE`, `400 INVALID_MODIFIERS`, `400 INVALID_REQUESTED_AT`, `409 ORDERS_PAUSED`, `409 RESTAURANT_CLOSED` (W1-B-ORD: проверка по `schedules`; при заданном `requestedAt` проверяется это время).

Ответ (и для `GET /users/me/pre-orders`, `GET /users/me/pre-orders/:id`):
```ts
interface OrderItemDto {
  id: string; menuItemId: string; name: string; quantity: number;
  unitPrice: number;                          // с модификаторами
  modifiers: Array<{ groupName: string; optionName: string; priceDelta: number }>;
  lineTotal: number;
}
interface OrderDto {
  id: string; restaurantId: string; orderNumber: number;   // сквозной номер внутри заведения, с 1
  status: PreOrderStatus; paymentMethod: PreOrderPaymentMethod; paymentStatus: OrderPaymentStatus;
  fulfillmentType: FulfillmentType;
  customerName: string; customerPhone: string;
  recipientName: string | null; recipientPhone: string | null;
  deliveryAddress: CreatePreOrderPayload['deliveryAddress'] | null;
  locationId: string | null; requestedAt: string | null;
  comment: string | null; cancelReason: string | null;
  totalAmount: number; items: OrderItemDto[];
  bookingId: string | null;
  statusChangedAt: string; createdAt: string; updatedAt: string;
}
interface PreOrderResponse extends OrderDto {
  payment: PaymentInfo | null;                // существующий тип
  paymentRedirectUrl: string | null;
}
```
`GET /users/me/pre-orders` возвращает `OrderDto[]` (последние 50, сначала новые). Сейчас он отдаёт сырые entity — W0-B2 переводит его на маппер.

### 3.3 Персонал: заказы (W1-B-ORD), право `VIEW_ORDERS` + `RestaurantAccessGuard`
- `GET /restaurants/:restaurantId/pre-orders?status=new,accepted&date=YYYY-MM-DD&updatedSince=ISO&page=1&limit=50`
  → `{ items: OrderDto[]; total: number; page: number; limit: number; serverTime: string }`.
  `date` считается в таймзоне `Europe/Minsk`. `updatedSince` нужен для дешёвого polling: клиент передаёт `serverTime` из прошлого ответа. Сортировка: `createdAt DESC`.
- `GET /restaurants/:restaurantId/pre-orders/:orderId` → `OrderDto`.
- `PATCH /restaurants/:restaurantId/pre-orders/:orderId/status` body `{ status: PreOrderStatus; cancelReason?: string }` → `OrderDto`.

### 3.4 Пауза приёма заказов (W0-B2)
`GET /restaurants/:restaurantId/order-settings` дополнительно возвращает `ordersPaused: boolean` (по умолчанию `false`).
Отдельный `PATCH /restaurants/:restaurantId/order-settings/pause` body `{ ordersPaused: boolean }` → `OrderSettings`, доступен ролям с `VIEW_ORDERS` (зал тоже может поставить паузу), остальные настройки — по-прежнему `MANAGE_ORDER_SETTINGS`.

### 3.5 Telegram (W1-B-TG), право `MANAGE_RESTAURANT` (владелец или управляющий)
- `POST /restaurants/:restaurantId/telegram/link-code` → `{ code: string; deepLink: string /* https://t.me/<bot>?start=<code> */; expiresAt: string /* +15 мин */ }`
- `GET /restaurants/:restaurantId/telegram/chats` → `Array<{ id: string; chatId: string; title: string | null; createdAt: string }>`
- `DELETE /restaurants/:restaurantId/telegram/chats/:id` → `204`
- `POST /telegram/webhook` — только для Telegram, проверяется заголовок `X-Telegram-Bot-Api-Secret-Token`.
- Сообщение о заказе: `№{orderNumber} · {тип} · {сумма} BYN · {оплата и её статус}`, затем позиции с модификаторами, имя и телефон, адрес или точка, время, комментарий. Кнопки `✅ Принять` / `❌ Отклонить` (callback `o:<orderId>:accept|reject`). После нажатия сообщение редактируется со статусом.

### 3.6 События и интерфейсы внутри бэкенда (W0-B2 объявляет, W1 использует)
```ts
// src/pre-orders/events/order-created.event.ts — имя события 'order.created'
class OrderCreatedEvent { orderId: string; restaurantId: string; orderNumber: number }
// src/pre-orders/events/order-status-changed.event.ts — имя события 'order.status_changed'
class OrderStatusChangedEvent {
  orderId: string; restaurantId: string; orderNumber: number;
  from: PreOrderStatus; to: PreOrderStatus;
  actor: { type: 'staff' | 'telegram' | 'system' | 'payment'; userId?: string; chatId?: string };
}
// src/pre-orders/interfaces/orders-staff-service.interface.ts, токен ORDERS_STAFF_SERVICE
interface IOrdersStaffService {
  getById(restaurantId: string, orderId: string): Promise<OrderDto>;
  changeStatus(p: { restaurantId: string; orderId: string; to: PreOrderStatus; cancelReason?: string;
                    actor: OrderStatusChangedEvent['actor']; actorRole?: UserRole }): Promise<OrderDto>;
}
```
W0-B2 регистрирует провайдер `ORDERS_STAFF_SERVICE → PreOrdersStaffService` (методы бросают `NotImplementedException`), экспортирует его из `PreOrdersModule` и эмитит `order.created` в `create()`. W1-B-ORD реализует методы. W1-B-TG импортирует `PreOrdersModule` и инжектит токен.

### 3.7 Онбординг, меню и реквизиты (W2-B-ONB ↔ W2-C-SA / W2-C-LEGAL)
- `GET /restaurants/admin/all?search=` (super_admin) → `Array<{ id; name; status; customDomain: string|null; ownerEmail: string|null; createdAt }>`
- `POST /restaurants/admin/create` (super_admin) body `{ name; address; unp?; customDomain?; owner: { email; firstName; lastName?; phone? } }`
  → `{ restaurant: RestaurantResponse; owner: { id; email }; setPasswordUrl: string; expiresAt: string }`. Новое заведение сразу `approved`; используется существующий `RestaurantsService.createByAdmin`.
- `POST /restaurants/admin/:id/owner-invite` (super_admin) → `{ setPasswordUrl; expiresAt }` (повторная ссылка).
- `POST /auth/set-password` body `{ token; password /* ≥8 */ }` → `AuthResponse` (как у login). Токен одноразовый, хранится только хэш, TTL `SET_PASSWORD_TTL_HOURS` (по умолчанию 72).
- Меню: `PATCH /restaurants/:restaurantId/menu/categories/:categoryId` `{ name?; sortOrder? }` → `MenuCategory`; `DELETE …/categories/:categoryId` → `204` или `409 CATEGORY_NOT_EMPTY`; `PUT /restaurants/:restaurantId/menu/categories/order` `{ ids: string[] }` → `204`.
- **Реквизиты заведения:** в `restaurants` добавляются `legalName`, `legalAddress`, `contactPhone`, `contactEmail` (все `string|null`); `unp` уже есть [проверено]. Отдаются в `GET /restaurants/:id`, меняются через `PATCH /restaurants/:id` (право `MANAGE_RESTAURANT`).
