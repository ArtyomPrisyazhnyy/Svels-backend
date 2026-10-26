# Object Storage (S3-совместимое)

Бэкенд хранит изображения в S3-совместимом object storage. Провайдер задаётся только через переменные окружения (`S3_*`). Локальная разработка и e2e используют `STORAGE_DRIVER=local` (каталог `./uploads`).

## Переменные приложения

| Переменная | Назначение |
|------------|------------|
| `STORAGE_DRIVER` | `local` или `s3` (`yandex` — устаревший alias для `s3`) |
| `S3_ENDPOINT` | API endpoint провайдера (например `https://s3.hoster.by`) |
| `S3_REGION` | Регион S3 |
| `S3_BUCKET` | Имя бакета |
| `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Ключи доступа |
| `S3_FORCE_PATH_STYLE` | `true` / `false` (path-style vs virtual-hosted) |
| `S3_PUBLIC_BASE_URL` | Публичный URL/CDN **без** завершающего `/`, для ссылок в API |
| `S3_LEGACY_PUBLIC_BASE_URLS` | Через запятую: старые базовые URL (например Yandex), чтобы `resolveKeyFromUrl` понимал уже сохранённые ссылки до миграции БД |

Устаревшие `YANDEX_STORAGE_*` читаются как fallback, пока не обновите `.env`.

## Переключение с Yandex Object Storage на hoster.by S3

Выполняйте на **стейджинге** с тестовыми ключами; в проде — только после бэкапа БД и бакета.

### 1. Подготовка нового бакета

1. Создайте бакет у hoster.by, включите публичное чтение объектов (или настройте CDN).
2. Запишите endpoint, region, ключи и итоговый публичный URL (`S3_PUBLIC_BASE_URL`).

### 2. Копирование объектов

В `.env` (или в одноразовом export) задайте **источник** (`SRC_S3_*`) и **назначение** (`S3_*`):

```bash
# источник — Yandex
export SRC_S3_ENDPOINT=https://storage.yandexcloud.net
export SRC_S3_REGION=ru-central-1
export SRC_S3_BUCKET=svels-media
export SRC_S3_ACCESS_KEY_ID=...
export SRC_S3_SECRET_ACCESS_KEY=...
export SRC_S3_FORCE_PATH_STYLE=true
export SRC_S3_PUBLIC_BASE_URL=https://storage.yandexcloud.net/svels-media

# назначение — hoster.by
export S3_ENDPOINT=https://s3.hoster.by
export S3_REGION=eu-central-1
export S3_BUCKET=svels-media
export S3_ACCESS_KEY_ID=...
export S3_SECRET_ACCESS_KEY=...
export S3_FORCE_PATH_STYLE=true
export S3_PUBLIC_BASE_URL=https://cdn.example.com/svels-media
```

Проверка без записи:

```bash
npm run storage:migrate -- --dry-run
```

Реальное копирование (идемпотентно, прогресс в `.storage-migrate-state.json`):

```bash
npm run storage:migrate -- --concurrency 8
```

Скрипт пропускает объекты, у которых в назначении совпадают размер и ETag; при сбое перезапустите ту же команду.

### 3. Переключение приложения

1. Обновите production `.env`: `STORAGE_DRIVER=s3` и все `S3_*`.
2. Добавьте `S3_LEGACY_PUBLIC_BASE_URLS` со старым Yandex URL (пока в БД остаются старые абсолютные ссылки).
3. Задеплойте бэкенд. Новые загрузки пойдут в hoster.by; старые URL в ответах API продолжат открываться, пока Yandex/CDN доступен.

### 4. Замена URL в базе (опционально)

Сначала оценка (dry-run по умолчанию):

```bash
npm run storage:migrate -- --rewrite-only --rewrite-urls
```

Применение:

```bash
npm run storage:migrate -- --rewrite-only --rewrite-urls --rewrite-apply
```

Обновляются таблицы: `menu_items`, `restaurants`, `restaurant_promo_banners` (поля с `imageUrl`, WebP и JSON-галереями). В лог выводятся **только счётчики** строк.

Копирование объектов и rewrite можно совместить:

```bash
npm run storage:migrate -- --rewrite-urls --rewrite-apply
```

### 5. После миграции

1. Убедитесь, что медиа открываются с нового `S3_PUBLIC_BASE_URL`.
2. Удалите `S3_LEGACY_PUBLIC_BASE_URLS`, когда в БД не осталось старых URL.
3. Отключите или удалите старый бакет Yandex после периода наблюдения.

## Клиент (Next.js)

В клиентском репозитории могут быть комментарии про Yandex URL — их меняют отдельно. Бэкенд отдаёт готовые абсолютные URL из БД и при новых загрузках из `S3_PUBLIC_BASE_URL`.

## Локальная разработка

`STORAGE_DRIVER=local` — без S3. Для проверки S3 используйте MinIO или тестовый бакет; **не** подставляйте production credentials в репозиторий.
