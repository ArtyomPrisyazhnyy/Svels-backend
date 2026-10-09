#!/usr/bin/env bash
set -euo pipefail

# Ежедневный бэкап Postgres → gzip → Yandex Object Storage, ротация 14 дней.
#
# Переменные окружения:
#   DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
#   YANDEX_BACKUP_BUCKET — bucket в Object Storage
#   YANDEX_BACKUP_ACCESS_KEY_ID, YANDEX_BACKUP_SECRET_ACCESS_KEY
#   YANDEX_BACKUP_ENDPOINT (default: https://storage.yandexcloud.net)
#   BACKUP_RETENTION_DAYS (default: 14)

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
ENDPOINT="${YANDEX_BACKUP_ENDPOINT:-https://storage.yandexcloud.net}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OBJECT_KEY="postgres/${DB_NAME:-svels}/${TIMESTAMP}.sql.gz"
TMP_FILE="$(mktemp /tmp/pg-backup.XXXXXX.sql.gz)"

cleanup() {
  rm -f "$TMP_FILE"
}
trap cleanup EXIT

export PGPASSWORD="${DB_PASSWORD:?DB_PASSWORD is required}"

pg_dump \
  -h "${DB_HOST:-postgres}" \
  -p "${DB_PORT:-5432}" \
  -U "${DB_USERNAME:-postgres}" \
  -d "${DB_NAME:-svels}" \
  --no-owner \
  --no-acl \
  | gzip -9 > "$TMP_FILE"

if [[ -z "${YANDEX_BACKUP_BUCKET:-}" ]]; then
  echo "YANDEX_BACKUP_BUCKET is not set" >&2
  exit 1
fi

export AWS_ACCESS_KEY_ID="${YANDEX_BACKUP_ACCESS_KEY_ID:?YANDEX_BACKUP_ACCESS_KEY_ID is required}"
export AWS_SECRET_ACCESS_KEY="${YANDEX_BACKUP_SECRET_ACCESS_KEY:?YANDEX_BACKUP_SECRET_ACCESS_KEY is required}"
export AWS_DEFAULT_REGION="${YANDEX_BACKUP_REGION:-ru-central1}"

aws --endpoint-url "$ENDPOINT" s3 cp "$TMP_FILE" "s3://${YANDEX_BACKUP_BUCKET}/${OBJECT_KEY}"

CUTOFF="$(date -u -d "-${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-"${RETENTION_DAYS}"d +%Y-%m-%dT%H:%M:%SZ)"

aws --endpoint-url "$ENDPOINT" s3api list-objects-v2 \
  --bucket "$YANDEX_BACKUP_BUCKET" \
  --prefix "postgres/${DB_NAME:-svels}/" \
  --query "Contents[?LastModified<='${CUTOFF}'].Key" \
  --output text | tr '\t' '\n' | while read -r key; do
  if [[ -n "$key" && "$key" != "None" ]]; then
    aws --endpoint-url "$ENDPOINT" s3 rm "s3://${YANDEX_BACKUP_BUCKET}/${key}"
  fi
done

echo "Backup uploaded: s3://${YANDEX_BACKUP_BUCKET}/${OBJECT_KEY}"
