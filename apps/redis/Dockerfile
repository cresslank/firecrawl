ARG REDIS_IMAGE=bitnamilegacy/redis:8.0.3@sha256:5927ff3702df7106bbb7dcc0f8e3d053d979253c3aecce53f07f40db990f823b
FROM ${REDIS_IMAGE}

COPY start-redis-server.sh /usr/bin/start-redis-server.sh

CMD ["/usr/bin/start-redis-server.sh"]
