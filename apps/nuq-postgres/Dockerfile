# Build a Postgres image that runs nuq.sql during initdb

ARG PG_MAJOR=17
ARG GOLANG_IMAGE=golang:1.26.8-trixie@sha256:771f3162219f7a66bb6be3fea1ba31f418932946a99ad9eac26ffd555dfcf393
ARG POSTGRES_IMAGE=postgres:17.11-trixie@sha256:67f41722b7a8cbdb868a44a4995c846eddfdc2973bccb291ce937dce88ad5675
FROM ${GOLANG_IMAGE} AS gosu-build
ENV GOMAXPROCS=2 GOFLAGS=-p=2
RUN /usr/local/go/bin/go install github.com/tianon/gosu@v0.0.0-20250923190938-6456aaa0f3c8

FROM ${POSTGRES_IMAGE}
ARG PG_MAJOR=17
ARG GIT_SHA
RUN printf '%s\n' "$GIT_SHA" | grep -Eq '^[0-9a-f]{40}$'
LABEL org.opencontainers.image.revision=$GIT_SHA

# Replace the upstream gosu binary with one built by a Go toolchain containing
# the current stdlib security fixes.
COPY --from=gosu-build /go/bin/gosu /usr/local/bin/gosu

# Install pg_cron for the specified Postgres major version
RUN set -eux; \
    printf 'Acquire::http::User-Agent "Debian docker-build";\n' > /etc/apt/apt.conf.d/99user-agent; \
    apt-get update; \
    apt-get upgrade -y; \
    apt-get install -y --no-install-recommends \
        postgresql-${PG_MAJOR}-cron; \
    rm -rf /var/lib/apt/lists/*

# Ensure pg_cron is preloaded on first startup by modifying the initdb template
# This must be set before the first server start (init scripts run after start)
RUN set -eux; \
    conf_sample="/usr/share/postgresql/${PG_MAJOR}/postgresql.conf.sample"; \
    sed -ri "s/^#?shared_preload_libraries\s*=.*/shared_preload_libraries = 'pg_cron'/" "$conf_sample"; \
    printf "\n# Added for pg_cron\ncron.database_name = 'postgres'\n" >> "$conf_sample"

# Copy nuq.sql so it is executed as part of the initdb sequence
COPY nuq.sql /docker-entrypoint-initdb.d/010-nuq.sql