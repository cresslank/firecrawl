# syntax=docker/dockerfile:1
FROM node:22.22.3-trixie-slim@sha256:02684a61c3e87ae3e9ec7ef98e312a6ec35483644e204e80fc053648c3e87d75 AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true

RUN corepack enable

FROM rust:1.95.0-slim@sha256:5021128d455987e7e7d6586bd7288fa876614821292614acbb761c21fc1ebb15 AS rust-toolchain

# Build Go shared library
FROM golang:1.24.13@sha256:d2d2bc1c84f7e60d7d2438a3836ae7d0c847f4888464e7ec9ba3a1339a1ee804 AS go-build
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
    git \
    pkg-config \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Copy a pinned Rust toolchain instead of running curl | sh during the build.
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    CARGO_NET_GIT_FETCH_WITH_CLI=true \
    PATH=/usr/local/cargo/bin:$PATH
COPY --from=rust-toolchain /usr/local/cargo /usr/local/cargo
COPY --from=rust-toolchain /usr/local/rustup /usr/local/rustup

# Copy source files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY . .

# Install dependencies
RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    --mount=type=cache,target=/usr/local/cargo/registry \
    --mount=type=cache,target=/app/native/target \
    pnpm install --frozen-lockfile

# Build the application
RUN pnpm run build

# Remove dev dependencies
RUN pnpm prune --prod --ignore-scripts

# Runtime stage
FROM base AS runtime

# Install runtime dependencies
RUN apt-get update && apt-get upgrade -y && apt-get install -y \
    --no-install-recommends \
    git \
    procps \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg \
    && rm -rf /var/lib/apt/lists/*

EXPOSE 8080
WORKDIR /app

# Copy built application
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/native ./native

# Copy Go shared library
COPY --from=go-build /app/sharedLibs/go-html-to-md/libhtml-to-markdown.so ./sharedLibs/go-html-to-md/

CMD ["node", "dist/src/harness.js", "--start-docker"]
