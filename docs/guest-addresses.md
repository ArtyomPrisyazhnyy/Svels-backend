# Сохранённые адреса доставки гостя (B-ADDR)

Гость заведения может хранить до **10** активных адресов доставки на ресторан, выбирать адрес при оформлении заказа и помечать один адрес как основной.

Все эндпоинты требуют JWT с ролью `user` и `user.restaurantId === :restaurantId`. Персонал и гости других заведений получают `403` с кодом `FORBIDDEN`.

Базовый путь: `/restaurants/:restaurantId/me/addresses` (UUID v7 в параметрах).

## Эндпоинты

| Метод | Путь | Описание |
|-------|------|----------|
| `GET` | `/` | Список адресов: сначала основной, затем `lastUsedAt DESC NULLS LAST`, затем `createdAt DESC` |
| `POST` | `/` | Создать адрес. Первый адрес становится основным. Дубликат (улица+дом+квартира, без учёта регистра и лишних пробелов) → **200** с существующим адресом. Лимит 10 → **409** `ADDRESS_LIMIT` |
| `PATCH` | `/:id` | Обновить поля. Чужой/удалённый → **404** `ADDRESS_NOT_FOUND` |
| `DELETE` | `/:id` | Мягкое удаление (**204**). Если удалён основной — основным становится последний использованный оставшийся |
| `POST` | `/:id/default` | Сделать адрес основным (одна транзакция, сброс предыдущего основного) |

## DTO

**CreateGuestAddressDto:** `label?`, `street`, `house`, `apartment?`, `entrance?`, `floor?`, `intercom?`, `comment?`, `isDefault?` — лимиты как у `DeliveryAddressDto` в pre-orders (`label` ≤ 40).

**UpdateGuestAddressDto:** те же поля, все опциональны.

**GuestAddressDto (ответ):** `id`, `label`, `street`, `house`, `apartment`, `entrance`, `floor`, `intercom`, `comment`, `isDefault`, `lastUsedAt`, `createdAt`, `updatedAt` (даты ISO 8601).

Текстовые поля проходят `sanitizeText` и trim; пустые строки → `null`.

## Интеграция с заказом

В `POST /restaurants/:restaurantId/pre-orders` для `fulfillmentType: delivery` дополнительно:

- `addressId?` — UUID v7 сохранённого адреса; копируется **снимок** в `deliveryAddress` jsonb заказа, обновляется `lastUsedAt`. Если переданы и `addressId`, и `deliveryAddress`, побеждает `addressId`.
- `saveAddress?` — после создания заказа сохранить адрес из `deliveryAddress` (дедуп, лимит 10 — при переполнении сохранение пропускается, заказ не падает).
- `addressLabel?` — подпись при сохранении (≤ 40).

Ошибки: `400 ADDRESS_NOT_FOUND`, `400 ADDRESS_REQUIRED` (как раньше, если нет ни адреса, ни `addressId`).

## Коды ошибок

| Код | HTTP | Когда |
|-----|------|--------|
| `FORBIDDEN` | 403 | Не гость заведения или роль персонала |
| `ADDRESS_NOT_FOUND` | 404 | PATCH/DELETE/заказ с чужим `addressId` |
| `ADDRESS_LIMIT` | 409 | Больше 10 активных адресов при `POST /me/addresses` |
| `ADDRESS_NOT_FOUND` | 400 | `addressId` в заказе не найден |
| `ADDRESS_REQUIRED` | 400 | Доставка без адреса |

## Миграция

Файл: `src/database/migrations/1791900000000-GUBAddr.ts` (класс `GUBAddr1791900000000`).

Таблица `guest_addresses`, индексы `IDX_guest_addresses_user_restaurant`, частичный уникальный `UQ_guest_addresses_default` на `(userId, restaurantId)` WHERE `isDefault = true AND deletedAt IS NULL`.

**Применение на Neon:** только владельцем репозитория, локально/в CI: `npm run migration:run`. Не запускать миграции на production Neon из автоматических агентов.
