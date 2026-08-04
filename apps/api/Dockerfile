# syntax=docker/dockerfile:1
FROM node:22.23.1-trixie-slim@sha256:e6d9a389d34ff9678438af985c9913fbd1eb6ed36e80fea56644f4b4f6dd70ba AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true

RUN corepack enable && corepack prepare pnpm@11.15.1 --activate

FROM rust:1.97.1-slim@sha256:5c6f46a6e4472ab1ca7ba7d494e6677f2f219ebc02f32025d3986f057635ec9c AS rust-toolchain

# Build Go shared library
FROM golang:1.25.12@sha256:9006890ecba0a168034d99516084099ae3114d9f2b7d6572c77f2dde57ebc980 AS go-build
WORKDIR /app
COPY sharedLibs/go-html-to-md ./sharedLibs/go-html-to-md

RUN cd sharedLibs/go-html-to-md && \
    go mod download && \
    go build -o libhtml-to-markdown.so -buildmode=c-shared html-to-markdown.go

FROM base AS build
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    --no-install-recommends \
    build-essential \
    ca-certificates \
    cmake \
    curl \
    git \
    pkg-config \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# FoundationDB client library (libfdb_c + headers), needed by the
# `foundationdb` npm package at install time on arches without prebuilds.
ARG FDB_VERSION=7.3.79
ARG FDB_SHA256_AMD64=52cc22565c42e7eb60c08f395a0626483735c311be0d80b7c035ac8e328e2fff
ARG FDB_SHA256_AARCH64=52de6931803c322e131c5e84cebb35d647237ef51a7df3df6fbe32b9b971e7fb
RUN ARCH=$(dpkg --print-architecture) && \
    case "$ARCH" in \
      amd64) FDB_ARCH=amd64; FDB_SHA256="$FDB_SHA256_AMD64" ;; \
      arm64) FDB_ARCH=aarch64; FDB_SHA256="$FDB_SHA256_AARCH64" ;; \
      *) echo "Unsupported FoundationDB architecture: $ARCH" >&2; exit 1 ;; \
    esac && \
    curl -fsSL -o /tmp/fdb-clients.deb \
      "https://github.com/apple/foundationdb/releases/download/${FDB_VERSION}/foundationdb-clients_${FDB_VERSION}-1_${FDB_ARCH}.deb" && \
    echo "$FDB_SHA256  /tmp/fdb-clients.deb" | sha256sum -c - && \
    dpkg -i /tmp/fdb-clients.deb && rm /tmp/fdb-clients.deb

# Copy a pinned Rust toolchain instead of running curl | sh during the build.
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    CARGO_NET_GIT_FETCH_WITH_CLI=true \
    PATH=/usr/local/cargo/bin:$PATH
COPY --from=rust-toolchain /usr/local/cargo /usr/local/cargo
COPY --from=rust-toolchain /usr/local/rustup /usr/local/rustup

# Copy dependency inputs. The native workspace is included here because its
# install script builds the Rust package; API TypeScript source is copied after
# dependency install so source-only changes do not invalidate this layer.
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY patches ./patches
COPY native ./native

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/native/target \
    pnpm install --frozen-lockfile

COPY . .

# Build the application from a clean output directory.
RUN rm -rf dist && pnpm run build
ARG GIT_SHA=unknown
RUN test -s dist/src/harness.js && \
    test -s dist/src/controllers/v0/crawl-status.js && \
    printf '%s\n' "$GIT_SHA" > BUILD_SHA

# Remove dev dependencies. pnpm prune in this workspace can retain the
# TypeScript 7 compiler package and its optional native compiler binary under
# node_modules/.pnpm even after pruning. TypeScript 6 is a runtime dependency
# of the deterministic JSON pipeline and must remain installed; its JavaScript
# API is retained while optional native compiler packages are not.
RUN pnpm prune --prod --ignore-scripts && \
    rm -rf node_modules/typescript-7 && \
    find node_modules/.pnpm -maxdepth 1 -type d -name 'typescript@7.*' -prune -exec rm -rf {} + && \
    find node_modules/.pnpm -maxdepth 1 -type d -name '@typescript+typescript-linux-*' -prune -exec rm -rf {} + && \
    find node_modules/.pnpm -maxdepth 3 -type d -name 'typescript-7' -prune -exec rm -rf {} +

# Runtime stage
FROM base AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    --no-install-recommends \
    ca-certificates \
    curl \
    git \
    procps \
    && rm -rf /root/.cache /pnpm \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && rm -rf /var/lib/apt/lists/*

# FoundationDB client library (libfdb_c + fdbcli)
ARG FDB_VERSION=7.3.79
ARG FDB_SHA256_AMD64=52cc22565c42e7eb60c08f395a0626483735c311be0d80b7c035ac8e328e2fff
ARG FDB_SHA256_AARCH64=52de6931803c322e131c5e84cebb35d647237ef51a7df3df6fbe32b9b971e7fb
RUN ARCH=$(dpkg --print-architecture) && \
    case "$ARCH" in \
      amd64) FDB_ARCH=amd64; FDB_SHA256="$FDB_SHA256_AMD64" ;; \
      arm64) FDB_ARCH=aarch64; FDB_SHA256="$FDB_SHA256_AARCH64" ;; \
      *) echo "Unsupported FoundationDB architecture: $ARCH" >&2; exit 1 ;; \
    esac && \
    curl -fsSL -o /tmp/fdb-clients.deb \
      "https://github.com/apple/foundationdb/releases/download/${FDB_VERSION}/foundationdb-clients_${FDB_VERSION}-1_${FDB_ARCH}.deb" && \
    echo "$FDB_SHA256  /tmp/fdb-clients.deb" | sha256sum -c - && \
    dpkg -i /tmp/fdb-clients.deb && rm /tmp/fdb-clients.deb

EXPOSE 8080
WORKDIR /app
ARG GIT_SHA=unknown
ENV FIRECRAWL_BUILD_SHA=$GIT_SHA

# Copy built application
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/native ./native
COPY --from=build /app/BUILD_SHA ./BUILD_SHA

# Copy Go shared library
COPY --from=go-build /app/sharedLibs/go-html-to-md/libhtml-to-markdown.so ./sharedLibs/go-html-to-md/

RUN node -e 'const fs = require("fs"); for (const p of ["dist/src/harness.js", "dist/src/controllers/v0/crawl-status.js", "BUILD_SHA"]) { if (!fs.statSync(p).size) throw new Error(`${p} missing or empty`); }'

CMD ["node", "dist/src/harness.js", "--start-docker"]
