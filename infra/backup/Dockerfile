# syntax=docker/dockerfile:1.7
# Backup image: pg_dump (Postgres 16 client) + age + rclone + supercronic.
# Runs as non-root. Secrets mounted at /run/secrets — never baked in.

FROM postgres:16-alpine

RUN apk add --no-cache \
      age \
      curl \
      ca-certificates \
      rclone \
      supercronic \
    && addgroup -S backup \
    && adduser -S -G backup -H -s /sbin/nologin backup \
    && mkdir -p /work /etc/supercronic \
    && chown -R backup:backup /work /etc/supercronic

COPY --chown=backup:backup pg-backup.sh /usr/local/bin/pg-backup.sh
COPY --chown=backup:backup crontab /etc/supercronic/crontab
RUN chmod +x /usr/local/bin/pg-backup.sh

USER backup
WORKDIR /work

HEALTHCHECK --interval=60s --timeout=5s --start-period=10s --retries=2 \
  CMD supercronic -test /etc/supercronic/crontab

CMD ["supercronic", "/etc/supercronic/crontab"]
