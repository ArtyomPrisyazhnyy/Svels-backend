# Лояльность: визиты и баланс гостя

Визит («огонёк») начисляется, когда предзаказ переходит в статус `completed`, и только если у гостя есть `userId` и программа включена (`flameDisplayEnabled`) в настройках заведения.

- Слушатель `LoyaltyOrderEventsListener` подписан на `order.status_changed`. Ошибки не пробрасываются: смена статуса заказа не должна ломаться из-за начисления.
- Идемпотентность: один заказ даёт не больше одного визита (`UNIQUE` по `orderId` в `loyalty_visits`).
- Баланс хранится в `guest_loyalty_balances` (ключ `restaurantId + userId`): `visits` — текущая серия, `totalVisits` — всего визитов, `lastVisitAt`.
- Сгорание серии: если с последнего визита прошло больше `flameExpireDays` дней, при следующем визите серия начинается с 1. Для ответа баланса серия, у которой истёк срок, отдаётся как `visits: 0`.
- Настройки (включено, `flameExpireDays`, уровни и награды) живут в модуле `loyalty-settings`; модуль `loyalty` только читает их через `LoyaltySettingsService`.

Эндпоинты (префикс `/restaurants/:restaurantId/loyalty`):

- `GET me` — баланс текущего пользователя в заведении. Нужен JWT; гостю и персоналу доступно.
- `GET guests/:userId` — баланс гостя для персонала с правом `VIEW_ORDERS` того же заведения. Гость или персонал другого заведения получают 403.

Форма ответа (`LoyaltyBalanceResponseDto`): `restaurantId`, `userId`, `enabled`, `rewardsEnabled`, `visits`, `totalVisits`, `lastVisitAt`, `expiresAt`, `currentLevel`, `nextLevel` (с `visitsLeft`), `availableRewards`. Даты — ISO-строки. Без записи баланса все счётчики равны нулю, даты равны `null`.

Применение наград в корзине и скидки в эту часть не входят.
