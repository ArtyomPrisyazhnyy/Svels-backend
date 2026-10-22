# Деплой Svels API (production)

Документ описывает выкладку **Svels-backend** (NestJS + Fastify) на типичный VPS с Docker. **Production БД — Postgres 16 в docker-compose** (сервис `postgres`), не внешний managed Postgres.

## Что входит в стек

| Компонент | Назначение |
|-----------|------------|
| **API** (`node dist/main`) | HTTP API, webhook Telegram, health |
| **Worker** (`node dist/worker`) | Очередь BullMQ, конвертация изображений (sharp) |
| **Redis** | Кэш, OTP/throttle, очереди |
| **Postgres** | Данные (volume `postgres_data` в compose) |
| **Caddy / nginx** | TLS, reverse proxy, `X-Forwarded-*` |
| **Web** (`svels-client`) | Next.js фронт (отдельный образ) |

Артефакты в репозитории:

- `Dockerfile` — multi-stage, Node 24, non-root, prod-зависимости, `HEALTHCHECK` → `GET /health`
- `.dockerignore`
- `docker-compose.prod.example.yml` — пример compose (копия лежит также в `deploy/docker-compose.prod.yml`)
- `deploy/Caddyfile`, `deploy/backup.sh`

## Сборка образа API

```bash
git clone <repo-url> Svels-backend
cd Svels-backend
docker build \
  --build-arg GIT_SHA="$(git rev-parse HEAD)" \
  -t svels-api:latest .
```

`GIT_SHA` попадает в `SENTRY_RELEASE` для Sentry (если задан `SENTRY_DSN`).

## Переменные окружения (production)

При `NODE_ENV=production` приложение **не стартует**, пока не пройдена валидация (`src/config/env.validation.ts`). Минимальный набор:

| Переменная | Описание |
|------------|----------|
| `DB_HOST` + `DB_PASSWORD` (или `DATABASE_URL` для особых случаев) | Postgres из compose |
| `REDIS_PASSWORD`, `THROTTLER_STORAGE=redis` | Redis и rate limit (если `REDIS_ENABLED` не `false`) |
| `JWT_SECRET` | ≥ 32 символов, не `change-me-in-production` |
| `BEPAY_CREDENTIALS_ENCRYPTION_KEY` | ≥ 32 символов |
| `REVALIDATE_SECRET`, `OTP_PEPPER` | ≥ 32 символов, не значения из `.env.example` |
| `API_PUBLIC_URL` | Публичный HTTPS URL API (webhook bePaid, Telegram) |
| `NEXT_SITE_URL` | HTTPS URL фронта |
| `CORS_ALLOWED_ORIGINS` | Список **https://** origin через запятую (админка, платформа) |
| `GOOGLE_OAUTH_CLIENT_ID` | Guest OAuth Google |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` | Бот заказов (webhook) |
| `STORAGE_DRIVER=s3` + `S3_*` | Медиа в S3-совместимом хранилище (см. ниже) |

### Object storage (S3)

| Переменная | Описание |
|------------|----------|
| `STORAGE_DRIVER` | `s3` в production, `local` для dev/e2e |
| `S3_ENDPOINT` | HTTPS API endpoint провайдера (например hoster.by) |
| `S3_REGION` | Регион (`us-east-1`, если провайдер игнорирует) |
| `S3_BUCKET` | Имя бакета для медиа |
| `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Ключи доступа |
| `S3_FORCE_PATH_STYLE` | `true` по умолчанию (path-style URLs) |
| `S3_PUBLIC_BASE_URL` | HTTPS-префикс публичных ссылок на файлы (CDN/домен), без завершающего `/` |

В БД хранятся **только object keys** (например `menu/<restaurantId>/<uuid>.webp`). Публичные URL собираются при отдаче API: `S3_PUBLIC_BASE_URL` + `/` + key.

`STORAGE_DRIVER=yandex` больше не поддерживается — при старте будет явная ошибка с подсказкой перейти на `S3_*`.

Дополнительно см. `.env.example`: Google staff login (`GOOGLE_CLIENT_ID`), Apple Guest OAuth, SMS/OTP, bePaid, Sentry (`SENTRY_DSN`), leads-бот и т.д.

Шаблон без секретов: скопируйте `.env.example` → `deploy/.env` и заполните на сервере.

### CORS в production

- В `CORS_ALLOWED_ORIGINS` указывайте **реальные HTTPS-домены** (например `https://admin.example.com`), не `localhost` и не `http://`.
- Кастомные домены заведений (`https://<customDomain>`) разрешаются динамически, если домен одобрен в БД.

### Trust proxy

За reverse proxy (Caddy/nginx) задайте `TRUST_PROXY=loopback, linklocal, uniquelocal` (значение по умолчанию в коде), чтобы корректно определять IP клиента и не доверять произвольному `X-Forwarded-For` из интернета.

## Миграции БД (ручной шаг)

Схема в production **только** через TypeORM migrations. Перед первым запуском API или после обновления версии:

```bash
# На хосте с исходниками и доступом к БД
npm ci
npm run migration:run
```

В Docker (образ уже содержит `deploy/run-migrations.mjs`):

```bash
docker compose -f deploy/docker-compose.prod.yml run --rm migrate
```

Пример compose включает one-shot сервис `migrate` перед `api`/`worker`; при желании отключите его и выполняйте миграции только вручную перед `up`.

**Не используйте** `DB_SYNC=true` в production.

После обновления на версию с object keys примените миграцию `StorageMediaKeys` (конвертация URL → keys в существующих строках). Делайте это только после бэкапа БД.

## Выкладка на VPS (Docker + Caddy)

1. Установите Docker Engine и Compose v2.
2. Соберите `svels-api` (см. выше) и образ клиента `svels-client`.
3. Подготовьте `deploy/.env` и при необходимости скопируйте `docker-compose.prod.example.yml`.
4. Запустите миграции (см. выше).
5. Поднимите стек:

```bash
cd deploy
export API_TAG=latest WEB_TAG=latest
docker compose -f docker-compose.prod.yml up -d
```

6. Проверка: `curl -fsS https://<API_HOST>/health` → `{"status":"ok","db":"up",...}`.

Подробности Caddy и on-demand TLS для кастомных доменов: `deploy/README.md`, `deploy/Caddyfile`. Эндпоинт `GET /ask?domain=` для Caddy **не публикуйте** наружу — только из сети compose.

### Telegram webhook

После того как `API_PUBLIC_URL` доступен по HTTPS:

```bash
curl -X POST "https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"${API_PUBLIC_URL}/telegram/webhook\",\"secret_token\":\"${TELEGRAM_WEBHOOK_SECRET}\"}"
```

## Альтернатива: nginx

Можно заменить Caddy на nginx:

- TLS: certbot или внешний LB с сертификатом.
- `proxy_pass` на `api:3000` и `web:3000`.
- Пробросьте `Host`, `X-Forwarded-For`, `X-Forwarded-Proto`.
- Сохраните `TRUST_PROXY` как в примере compose.

## Бэкапы Postgres

Скрипт `deploy/backup.sh`:

- `pg_dump` сервиса Postgres из compose → gzip
- загрузка в **отдельный** S3-бакет через AWS CLI (`BACKUP_S3_*`)
- ротация **14 дней** (`BACKUP_RETENTION_DAYS`)

Переменные: `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY_ID`, `BACKUP_S3_SECRET_ACCESS_KEY`, опционально `BACKUP_S3_REGION`, `BACKUP_S3_FORCE_PATH_STYLE`, плюс `DB_*` как у приложения.

Пример cron на хосте (ежедневно в 03:15 UTC, подставьте путь к `deploy/.env`):

```cron
# 15 3 * * * set -a && source /opt/svels/deploy/.env && set +a && /opt/svels/Svels-backend/deploy/backup.sh >> /var/log/svels-pg-backup.log 2>&1
```

### Восстановление из бэкапа

1. Остановите `api` и `worker` (`docker compose stop api worker`).
2. Скачайте архив из бакета бэкапов.
3. Восстановите в Postgres compose:

```bash
gunzip -c backup.sql.gz | PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -U "$DB_USERNAME" -d "$DB_NAME"
```

4. Поднимите сервисы снова.

Перед восстановлением на production согласуйте downtime и проверьте, что дамп соответствует версии схемы.

## Наблюдаемость

- **Логи**: при `NODE_ENV=production` Nest пишет **JSON** в stdout (удобно для Loki/CloudWatch).
- **Sentry**: задайте `SENTRY_DSN`; без DSN интеграция отключена. Release — из `SENTRY_RELEASE` / `GIT_SHA` при сборке образа. PII (email, телефон, токены) вычищаются перед отправкой.
- **Health**: `GET /health` (в Docker `HEALTHCHECK`).

## Graceful shutdown

API вызывает `enableShutdownHooks()` — при `SIGTERM`/`SIGINT` Nest корректно закрывает соединения. Worker обрабатывает те же сигналы в `src/worker.ts`.

## Обновление версии

```bash
docker build --build-arg GIT_SHA="$(git rev-parse HEAD)" -t svels-api:<tag> .
# миграции
docker compose -f deploy/docker-compose.prod.yml run --rm migrate
docker compose -f deploy/docker-compose.prod.yml up -d
```

Откат миграции — только осознанно: `npm run migration:revert` (см. `deploy/README.md`).
