ARG REDIS_IMAGE=redis:8.6.4-alpine@sha256:2cc044fc5a07c9b701f8f1255a309ae9ad7856e694ac03513bf3648c01e40763
FROM ${REDIS_IMAGE}

USER root
RUN apk upgrade --no-cache

COPY start-redis-server.sh /usr/bin/start-redis-server.sh

CMD ["/usr/bin/start-redis-server.sh"]
