# Production deploy (Docker Compose)

Стек: **Postgres 16**, **Redis 7** (с паролем), **API** + **worker** (один образ `svels-api`), **web** (`svels-client`), **Caddy** (TLS, on-demand для кастомных доменов).

## Первая установка на VM

1. Установите Docker и Docker Compose v2.
2. Склонируйте репозитории backend и client; соберите образы:
   ```bash
   docker build -t svels-api:latest /path/to/Svels-backend
   docker build -t svels-client:latest /path/to/Svels-client
   ```
3. В каталоге `deploy/` создайте `.env` на основе корневого `.env.example` плюс прод-значения:
   - `DB_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `BEPAY_CREDENTIALS_ENCRYPTION_KEY`
   - `API_PUBLIC_URL`, `NEXT_SITE_URL`, `CORS_ALLOWED_ORIGINS`
   - `PLATFORM_DOMAIN`, `ADMIN_DOMAIN`, `ACME_EMAIL` (для Caddy)
   - `WEB_TAG` / `API_TAG` при необходимости
4. Запуск:
   ```bash
   cd deploy
   export WEB_TAG=latest API_TAG=latest
   docker compose -f docker-compose.prod.yml up -d
   ```
5. One-shot **migrate** выполняется перед стартом `api` и `worker`.
6. Эндпоинт `GET /ask?domain=` на API **не публикуется** наружу — только из сети compose для Caddy on-demand TLS.

### Telegram webhook после деплоя

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${API_PUBLIC_URL}/telegram/webhook\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\"}"
```

## Обновление

```bash
docker build -t svels-api:<tag> ..
docker pull svels-client:<tag>   # или локальная сборка client
export API_TAG=<tag> WEB_TAG=<tag>
docker compose -f docker-compose.prod.yml up -d
```

Миграции применяются автоматически сервисом `migrate` при каждом `up`.

## Откат миграции

На хосте с доступом к БД и исходникам backend:

```bash
npm run migration:revert
```

В compose можно однократно запустить:

```bash
docker compose -f docker-compose.prod.yml run --rm migrate npm run migration:revert
```

Откатывайте миграции только если новая версия API ещё не зависит от схемы.

## Восстановление из бэкапа

1. Скачайте архив из Object Storage (`deploy/backup/pg-backup.sh` кладёт в `postgres/<DB_NAME>/`).
2. Остановите API/worker или переведите приложение в maintenance.
3. Восстановите:
   ```bash
   gunzip -c backup.sql.gz | psql -h "$DB_HOST" -U "$DB_USERNAME" -d "$DB_NAME"
   ```
4. Поднимите сервисы снова.

Скрипт бэкапа: `deploy/backup/pg-backup.sh` (нужны `pg_dump`, `gzip`, AWS CLI с endpoint Yandex). Ротация — **14 дней** (`BACKUP_RETENTION_DAYS`).

## Проверка конфигурации

```bash
docker compose -f deploy/docker-compose.prod.yml config
```
