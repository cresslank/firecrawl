ARG REDIS_IMAGE=redis:8.6.6-alpine@sha256:75934ddb37bfaebe3b4082ba673cac39f66495244134f33dd0a502ce03cdcd36
FROM ${REDIS_IMAGE}

ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA

USER root
RUN apk add --no-cache --upgrade \
      'libcrypto3=3.5.8-r0' \
      'libssl3=3.5.8-r0'

COPY start-redis-server.sh /usr/bin/start-redis-server.sh

CMD ["/usr/bin/start-redis-server.sh"]
