# Spike: интеграция iiko (iikoCloud / iikoTransport API)

Дата: 2026-10-22. Репозиторий: Svels-backend. Цель spike — проверить доступ к **iikoCloud** (`https://api-ru.iiko.services`) и заложить абстракцию `PosProvider` без подключения к боевому потоку заказов.

## Краткий итог

| Шаг | Статус на demo `apiLogin: demoDelivery` | Комментарий |
|-----|----------------------------------------|-------------|
| Auth v1 `POST /api/1/access_token` | **Не работает** | `Login demoDelivery is not authorized.` |
| Auth v2 `POST /api/v2/access_token` | **Не проверен без кредов** | Нужны `appId`, `clientSecret`, `apiKey` с [портала разработчика](https://public-api.iikoweb.ru/portal) и iikoWeb |
| Organizations / terminal groups / menu / stop-list / order | **Не выполнялись** | Нет JWT; код и `npm run iiko:spike` готовы при появлении кредов |

Публичный demo-логин `demoDelivery` из [fisher85/iiko-api](https://github.com/fisher85/iiko-api) **больше не авторизуется** на `api-ru.iiko.services`. Старый **iikoBiz API** на `iiko.biz:9900` с тем же логином/паролем по-прежнему выдаёт токен, но это **другой API (v0)** и другой хост — не замена iikoCloud.

### Что именно упало (сырой ответ, 2026-10-22)

```http
POST https://api-ru.iiko.services/api/1/access_token
Content-Type: application/json

{"apiLogin":"demoDelivery"}
```

```json
{
  "correlationId": "a8a22636-c4c1-4bfb-a341-cb711a15c3fc",
  "errorDescription": "Login demoDelivery is not authorized."
}
```

Попытка v2 без валидных UUID в `appId` (проверка формата API):

```json
{
  "correlationId": "5140be2c-6319-4bb8-9dd4-c73b27bb8dbb",
  "errorDescription": "Error converting value \"test\" to type 'System.Guid'. Path 'appId'...",
  "error": "INVALID_BODY_JSON_FORMAT"
}
```

### Справочно: legacy demo на iiko.biz (не iikoCloud)

Только для понимания «живого» demo-аккаунта доставки (не использовать в прод-коде Svels):

```http
GET https://iiko.biz:9900/api/0/auth/access_token?user_id=demoDelivery&user_secret=PI1yFaKFCGvvJKi
```

Ответ — строка-токен. Организация (усечено):

```json
[
  {
    "id": "e464c693-4a57-11e5-80c1-d8d385655247",
    "name": "DEmo",
    "currencyIsoName": "RUB"
  }
]
```

## Реализация в коде

- `src/integrations/pos/pos-provider.interface.ts` — контракт: `syncMenu`, `getStopList`, `createOrder`, `getOrderStatus`, webhook (`parseWebhook` / `handleWebhook`).
- `src/integrations/pos/iiko/` — `IikoHttpClient`, `IikoPosProvider`, мапперы меню/заказов.
- `src/integrations/pos/pos.module.ts` — Nest-модуль; **не импортирован** в `AppModule`.
- По умолчанию выключено: `IIKO_POS_ENABLED` не `true`.

### Переменные окружения

| Переменная | Назначение |
|------------|------------|
| `IIKO_POS_ENABLED` | `true` — разрешить использование провайдера |
| `IIKO_API_BASE_URL` | по умолчанию `https://api-ru.iiko.services` |
| `IIKO_API_KEY` | apiKey (v2), в v1 можно как `apiLogin` |
| `IIKO_APP_ID` | UUID приложения (v2) |
| `IIKO_CLIENT_SECRET` | секрет приложения (v2) |
| `IIKO_API_LOGIN` | legacy v1 `apiLogin` (если ещё поддерживается у клиента) |
| `IIKO_TIMEOUT_MS` | таймаут HTTP, default 30000 |

### Запуск spike

```bash
export IIKO_POS_ENABLED=true
export IIKO_API_KEY=...
export IIKO_APP_ID=...
export IIKO_CLIENT_SECRET=...
npm run iiko:spike
```

Сценарий: auth → organizations → terminal_groups → nomenclature → external menus → stop_lists → тестовый **самовывоз** (`DeliveryByClient`) с телефоном `+375 29 000-00-01` → `deliveries/by_id`.

## Эндпоинты iikoCloud (целевые)

| Задача | Метод |
|--------|--------|
| Авторизация v2 | `POST /api/v2/access_token` |
| Авторизация v1 (deprecated) | `POST /api/1/access_token` |
| Организации | `POST /api/1/organizations` |
| Терминальные группы | `POST /api/1/terminal_groups` |
| RMS-меню | `POST /api/1/nomenclature` |
| Список внешних меню | `POST /api/2/menu` |
| Внешнее меню | `POST /api/menu/v3/by_id` (предпочтительно) |
| Стоп-лист | `POST /api/1/stop_lists` |
| Создание доставки/самовывоза | `POST /api/1/deliveries/create` (команда, при необходимости `POST /api/1/commands/status`) |
| Статус заказа | `POST /api/1/deliveries/by_id` |
| Webhooks | исходящие POST на URL заведения; настройка `POST /api/1/webhooks/update_settings` |

Документация: [api-ru.iiko.services/api-docs](https://api-ru.iiko.services/api-docs/docs), примеры: [examples.iiko.ru](https://examples.iiko.ru).

## Маппинг меню iiko → Svels (`MenuItem`)

| Svels | iiko (external menu v3 / nomenclature) | Примечание |
|-------|----------------------------------------|------------|
| `MenuItem.id` | новый UUID v7 в Svels | В POS хранить `posExternalId` (поле — отдельная миграция в production) |
| `name` | `item.name` / `product.name` | |
| `description` | `description` | |
| `price` | `itemSizes[].prices[]` или `sizePrices` | Для размеров — отдельные `MenuItem` с `variantLabel` или одна позиция + модификатор размера |
| `categoryId` | `itemCategories[].id` / `parentGroup` | Синк категорий `menu_categories` |
| `modifierGroups` | `itemModifierGroups` | `MenuModifierGroup`: `selectionType` из min/max; `options[].id` = `itemId` модификатора |
| `isAvailable` | не в стоп-листе + `isHidden !== true` | Периодический `getStopList` |
| `imageUrl` | `buttonImageUrl` / медиа из меню | Загрузка в Svels Storage |

Черновики после маппера: `PosMenuProductDraft`, `PosMenuModifierGroupDraft` в `pos.types.ts`.

### Размеры и модификаторы

- **Размеры**: `itemSizes[].sizeId` — в заказе передавать `productId` + `sizeId` (уточнить по ответу реального меню заведения).
- **Модификаторы**: в `deliveries/create` — `modifiers[]` с `productId`, `amount`, `productGroupId`.

## Маппинг заказа Svels → iiko

| Svels pre-order | iiko `deliveries/create` |
|-----------------|--------------------------|
| `fulfillmentType: takeaway` | `orderServiceType: DeliveryByClient` |
| `fulfillmentType: delivery` | `DeliveryByCourier` + `deliveryPoint` |
| Телефон гостя | `phone`, `customer.phone` (нормализация E.164) |
| `items[].menuItemId` | `productId` (внешний UUID блюда) |
| Модификаторы строки | `items[].modifiers` |
| Комментарий | `order.comment` |
| Внутренний номер | `externalNumber` = id заказа Svels |

Тестовый телефон spike: **`+375 29 000-00-01`**.

### Статусы

| iiko (примеры) | Svels `PreOrderStatus` |
|----------------|------------------------|
| Unconfirmed | `new` |
| WaitCooking / ReadyForCooking | `accepted` |
| CookingStarted | `preparing` |
| CookingCompleted / Waiting / OnWay | `ready` |
| Delivered / Closed | `completed` |
| Cancelled | `cancelled` |

Реализация: `mapIikoDeliveryStatusToSvels` в `iiko-order.mapper.ts`.

## Webhook / polling

1. **Webhook (предпочтительно)**: iiko шлёт события обновления доставки на HTTPS endpoint Svels; URI и фильтры — через `/api/1/webhooks/update_settings`. Парсинг spike: `parseIikoWebhookPayload`.
2. **Polling**: `deliveries/by_id` по сохранённому `posOrderId` до финального статуса.
3. В production: идемпотентность по `correlationId` / `posOrderId`, проверка подписи (если включена у клиента).

## Лицензирование (реальные заведения)

- **iikoCloud API**: API-ключ в iikoWeb, приложение на [портале разработчика](https://public-api.iikoweb.ru/portal); набор restriction groups на ключе (меню, заказы, стоп-листы и т.д.).
- Исторически **iikoDelivery API Connector** (~500 ₽/мес) для старого Biz API — для Cloud-модели ориентир на лицензии iikoOffice/iikoCloud и права ключа (уточнять у менеджера iiko / api@iiko.ru).
- Колл-центр: лицензии могут вешаться на КЦ, а не на точку.

## Риски

- Отключение legacy `apiLogin` без перехода на v2.
- Команды создания заказа асинхронны (`commands/status`).
- Расхождение внешнего меню и RMS nomenclature.
- Стоп-листы по terminal group — нужен корректный `terminalGroupId`.
- Часовой пояс и `deliveryDate` (локаль терминала).
- Eventual consistency при изменении номенклатуры через новые nomenclature API.

## Оценка сроков production-интеграции

| Этап | Оценка |
|------|--------|
| Креды, spike на staging-ключе клиента | 0.5–1 дн |
| Синк меню + стоп-листы (worker, маппинг, админ UI) | 3–5 дн |
| Создание заказа из pre-order + обработка ошибок | 3–4 дн |
| Статусы (webhook + fallback polling) + тесты | 2–3 дн |
| Наблюдаемость, документация для поддержки | 1–2 дн |
| **Итого** | **~10–15 рабочих дней** (1 разработчик), без учёта согласований с iiko/заведением |

## Единый интерфейс для r_keeper, Frontpad, Jupiter

Все адаптеры реализуют `PosProvider`:

| Метод | r_keeper | Frontpad | Jupiter |
|-------|----------|----------|---------|
| `syncMenu` | R-Keeper XML/JSON меню | API каталога | API номенклатуры |
| `getStopList` | стоп-лист блюд | остатки/доступность | аналог |
| `createOrder` | создание чека/заказа | отправка заказа | создание заказа |
| `getOrderStatus` | статус по id | polling | статус |
| webhook | callback URL | webhook заказа | зависит от версии |

В `AppModule` останется один токен `POS_PROVIDER`; выбор реализации — по настройкам ресторана (`posProvider: iiko | rkeeper | ...`).

## Тесты

Unit-тесты с моком `fetch`: `src/integrations/pos/iiko/*.spec.ts`.

```bash
npm test -- --testPathPatterns=integrations/pos
```
