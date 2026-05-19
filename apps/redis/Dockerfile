ARG REDIS_IMAGE=redis:8.6.3-alpine@sha256:d146f83b1e0f02fc27c26a50cee39338c736674c5959db84363e6ae3cd9e02d2
FROM ${REDIS_IMAGE}

USER root
RUN apk upgrade --no-cache

COPY start-redis-server.sh /usr/bin/start-redis-server.sh

CMD ["/usr/bin/start-redis-server.sh"]
