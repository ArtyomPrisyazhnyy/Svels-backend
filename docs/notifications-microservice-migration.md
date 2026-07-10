# Вынос уведомлений о заявках в отдельный микросервис

Документ описывает, как текущая реализация live-обновлений заявок рестораторов в панели суперадмина
устроена сейчас и как её вынести в отдельный сервис без переписывания бизнес-логики.

## Текущая архитектура (монолит)

```
RestaurantsModule                    NotificationsModule
─────────────────                    ───────────────────
POST /restaurants/register
  → save в БД
  → EventEmitter: restaurant.registration.submitted
        ───────────────────────────────────────────────→ RestaurantRegistrationListener
                                                           → IRegistrationNotificationPublisher
                                                           → SSE fan-out подписчикам

POST /restaurants/admin/registrations/review
  → update статуса
  → EventEmitter: restaurant.registration.reviewed
        ───────────────────────────────────────────────→ RestaurantRegistrationListener
                                                           → SSE: registration.reviewed

GET /admin/notifications/registrations/stream (SSE, super_admin)
  ← push событий в открытые вкладки суперадмина
```

### Ключевые файлы

| Файл | Роль |
|------|------|
| `src/shared/dto/pending-registration.dto.ts` | Контракт payload заявки (общий для REST и SSE) |
| `src/restaurants/events/restaurant-registration-*.event.ts` | Доменные события модуля restaurants |
| `src/notifications/interfaces/registration-notification-publisher.interface.ts` | Порт публикации (абстракция transport) |
| `src/notifications/services/registration-notifications.service.ts` | In-memory реализация + SSE stream |
| `src/notifications/listeners/restaurant-registration.listener.ts` | Мост EventEmitter → publisher |
| `src/features/admin/hooks/useRegistrationNotifications.ts` (frontend) | Подписка клиента на SSE |

### Принципы, которые уже соблюдены

1. **Restaurants не импортирует Notifications** — связь только через `EventEmitter` и shared DTO.
2. **Publisher за интерфейсом** — сегодня in-memory, завтра Redis/RabbitMQ.
3. **SSE только server → client** — не нужен WebSocket для односторонних push-уведомлений.
4. **Начальная загрузка через REST** — `GET /restaurants/admin/registrations/pending`; SSE доставляет только дельты.

---

## Этап 2: Несколько инстансов монолита (Redis Pub/Sub)

Когда поднимаете 2+ реплики бэкенда, in-memory fan-out перестаёт работать между процессами.

### Изменения

1. Создать `RedisRegistrationNotificationPublisher implements IRegistrationNotificationPublisher`:
   - `publishSubmitted` → `PUBLISH svels:registration:submitted {json}`
   - `publishReviewed` → `PUBLISH svels:registration:reviewed {json}`

2. `RegistrationNotificationsService` при старте модуля:
   - `SUBSCRIBE` на каналы Redis
   - при сообщении — fan-out локальным SSE-подписчикам (как сейчас)

3. `RestaurantRegistrationListener` **не меняется** — он по-прежнему вызывает publisher через DI.

4. Restaurants по-прежнему эмитит доменные события локально; listener вызывает Redis publisher.

### Redis-каналы (константы)

```
svels:events:registration:submitted
svels:events:registration:reviewed
```

Payload — тот же JSON, что в `RegistrationStreamMessage`.

---

## Этап 3: Отдельный микросервис `notifications-service`

### Разделение ответственности

| Сервис | Ответственность |
|--------|-----------------|
| **restaurants-service** | CRUD заявок, модерация, БД `restaurant_registration_requests` |
| **notifications-service** | Подписка на события, SSE/WebSocket, fan-out суперадминам |

### Контракт сообщений (не меняется)

```json
{
  "eventType": "restaurant.registration.submitted",
  "occurredAt": "2026-06-23T12:00:00.000Z",
  "payload": {
    "id": "...",
    "name": "...",
    "unp": "...",
    "locations": [],
    "applicantId": "...",
    "status": "pending",
    "createdAt": "..."
  }
}
```

```json
{
  "eventType": "restaurant.registration.reviewed",
  "occurredAt": "2026-06-23T12:01:00.000Z",
  "payload": { "requestId": "..." }
}
```

Рекомендуемый transport между сервисами: **RabbitMQ** (topic exchange) или **Redis Streams**.

### restaurants-service после выноса

```typescript
// После save заявки — только публикация в брокер
await this.messageBus.publish('restaurant.registration.submitted', payload);
```

Локальный `EventEmitter` можно оставить для in-process side effects или убрать полностью.

### notifications-service

```
Consumer (RabbitMQ/Redis)
  → RegistrationNotificationsService.broadcast()
  → SSE GET /admin/notifications/registrations/stream
```

- JWT-валидация super_admin (общий auth-service или shared JWT secret).
- Не хранит заявки — только транзит событий.
- Горизонтальное масштабирование: каждый инстанс держит своих SSE-клиентов, все слушают одну очередь.

### Frontend

**Не меняется** — тот же URL SSE и те же типы событий:

- `registration.submitted` → добавить карточку
- `registration.reviewed` → убрать карточку

---

## Этап 4 (опционально): WebSocket вместо SSE

Если понадобится двусторонняя связь (typing indicators, ack и т.д.):

1. Сохранить тот же `RegistrationStreamMessage` как payload WS-фрейма.
2. Заменить `@Sse()` на `@WebSocketGateway` в notifications-service.
3. Frontend: заменить `fetchEventSource` на `WebSocket` + тот же parser.

Контракт событий и брокер сообщений остаются прежними.

---

## Чеклист миграции

- [ ] Вынести `PendingRegistrationDto` и event types в shared npm-пакет / proto
- [ ] Заменить `EventEmitter` в restaurants на publish в RabbitMQ
- [ ] Развернуть notifications-service с consumer + SSE
- [ ] Настроить API Gateway: `/admin/notifications/*` → notifications-service
- [ ] Удалить `NotificationsModule` из монолита
- [ ] E2E: submit заявки → событие в брокере → SSE на UI суперадмина

---

## Почему не polling

Polling (раз в N секунд) проще, но не даёт «немедленно». SSE выбран как минимально достаточное решение с простым путём к микросервису через message bus.
