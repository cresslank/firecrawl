ARG REDIS_IMAGE=redis:8.6.7-alpine@sha256:ac2da09bc822f325a9f68f533120b86fa39c1b8db46b3aa7c1bbea7fdfd4fcba
FROM ${REDIS_IMAGE}

ARG GIT_SHA
RUN printf '%s\n' "$GIT_SHA" | grep -Eq '^[0-9a-f]{40}$'
LABEL org.opencontainers.image.revision=$GIT_SHA

USER root
RUN apk add --no-cache --upgrade \
      'libcrypto3=3.5.8-r0' \
      'libssl3=3.5.8-r0' \
      'setpriv=2.41.6-r1'

COPY start-redis-server.sh /usr/bin/start-redis-server.sh

CMD ["/usr/bin/start-redis-server.sh"]
