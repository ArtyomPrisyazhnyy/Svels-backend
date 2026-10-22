#!/usr/bin/env bash
set -euo pipefail

# Ночной бэкап Postgres из docker-compose → gzip → отдельный S3-бакет (hoster.by и др.).
#
# Переменные:
#   DB_HOST, DB_PORT, DB_USERNAME, DB_PASSWORD, DB_NAME
#   BACKUP_S3_ENDPOINT (https://...)
#   BACKUP_S3_REGION (default: us-east-1)
#   BACKUP_S3_BUCKET
#   BACKUP_S3_ACCESS_KEY_ID, BACKUP_S3_SECRET_ACCESS_KEY
#   BACKUP_S3_FORCE_PATH_STYLE (default: true)
#   BACKUP_RETENTION_DAYS (default: 14)

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-14}"
ENDPOINT="${BACKUP_S3_ENDPOINT:?BACKUP_S3_ENDPOINT is required}"
BUCKET="${BACKUP_S3_BUCKET:?BACKUP_S3_BUCKET is required}"
REGION="${BACKUP_S3_REGION:-us-east-1}"
FORCE_PATH_STYLE="${BACKUP_S3_FORCE_PATH_STYLE:-true}"
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

export AWS_ACCESS_KEY_ID="${BACKUP_S3_ACCESS_KEY_ID:?BACKUP_S3_ACCESS_KEY_ID is required}"
export AWS_SECRET_ACCESS_KEY="${BACKUP_S3_SECRET_ACCESS_KEY:?BACKUP_S3_SECRET_ACCESS_KEY is required}"
export AWS_DEFAULT_REGION="$REGION"

AWS_ARGS=(--endpoint-url "$ENDPOINT")
if [[ "$FORCE_PATH_STYLE" == "true" ]]; then
  AWS_ARGS+=(--cli-connect-timeout 60)
fi

aws "${AWS_ARGS[@]}" s3 cp "$TMP_FILE" "s3://${BUCKET}/${OBJECT_KEY}"

CUTOFF="$(date -u -d "-${RETENTION_DAYS} days" +%Y-%m-%dT%H:%M:%SZ 2>/dev/null || date -u -v-"${RETENTION_DAYS}"d +%Y-%m-%dT%H:%M:%SZ)"

aws "${AWS_ARGS[@]}" s3api list-objects-v2 \
  --bucket "$BUCKET" \
  --prefix "postgres/${DB_NAME:-svels}/" \
  --query "Contents[?LastModified<='${CUTOFF}'].Key" \
  --output text | tr '\t' '\n' | while read -r key; do
  if [[ -n "$key" && "$key" != "None" ]]; then
    aws "${AWS_ARGS[@]}" s3 rm "s3://${BUCKET}/${key}"
  fi
done

echo "Backup uploaded: s3://${BUCKET}/${OBJECT_KEY}"
