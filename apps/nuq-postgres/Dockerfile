# Build a Postgres image that runs nuq.sql during initdb

ARG PG_MAJOR=17
ARG GOLANG_IMAGE=golang:1.25.12-trixie@sha256:c699a45b4ed445f5a618233d1910f7c889dd52b831594047eff8e6a52794c814
ARG POSTGRES_IMAGE=postgres:17.10-trixie@sha256:2203e6282d9e7de7c24d7da234e2a744fb325df366a3fd8ed940e8abbee39527
FROM ${GOLANG_IMAGE} AS gosu-build
RUN /usr/local/go/bin/go install github.com/tianon/gosu@v0.0.0-20250923190938-6456aaa0f3c8

FROM ${POSTGRES_IMAGE}
ARG PG_MAJOR=17

# Replace the upstream gosu binary with one built by a Go toolchain containing
# the current stdlib security fixes.
COPY --from=gosu-build /go/bin/gosu /usr/local/bin/gosu

# Install pg_cron for the specified Postgres major version
RUN set -eux; \
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