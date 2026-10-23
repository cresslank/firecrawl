# syntax=docker/dockerfile:1
# Redis 8.8.3 patches CVE-2026-25243. Pin the multi-arch index digest and
# keep a checked-out revision label. Debian, not Alpine: the previous
# 8.6.7-alpine derivative existed only to close Alpine OpenSSL findings.
ARG REDIS_IMAGE=redis:8.8.3@sha256:418e397fd48d66e450af13baab123397f2d2580b07ef310c3a5dbe96c3d731f1
FROM ${REDIS_IMAGE}

ARG GIT_SHA
RUN printf '%s\n' "$GIT_SHA" | grep -Eq '^[0-9a-f]{40}$'
LABEL org.opencontainers.image.revision=$GIT_SHA

# The official entrypoint drops uid 0 to redis (999) and chowns /data unless
# these are set. The live volume is root-owned; do not let a recreate steal it.
ENV SKIP_DROP_PRIVS=1 SKIP_FIX_PERMS=1
USER root

COPY start-redis-server.sh /usr/bin/start-redis-server.sh

CMD ["/usr/bin/start-redis-server.sh"]
