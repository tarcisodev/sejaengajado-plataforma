#!/bin/sh
set -eu

# Mount Docker secrets (*_FILE) into process env before Nest loadEnv.
mount_file_secret() {
  name="$1"
  file_var="${name}_FILE"
  eval "file_path=\${${file_var}:-}"
  if [ -n "${file_path}" ] && [ -f "${file_path}" ]; then
    value="$(tr -d '\r\n' < "${file_path}")"
    export "${name}=${value}"
  fi
}

mount_file_secret DATABASE_URL
mount_file_secret ADMIN_DATABASE_URL
mount_file_secret SUPABASE_JWT_SECRET
mount_file_secret SUPABASE_SERVICE_ROLE_KEY
mount_file_secret SMTP_URL
mount_file_secret ASAAS_API_KEY
mount_file_secret ASAAS_WEBHOOK_TOKEN
mount_file_secret S3_ACCESS_KEY
mount_file_secret S3_SECRET_KEY
mount_file_secret GOOGLE_PLACES_API_KEY
mount_file_secret HC_JOBS_URL

exec node dist/main.js
