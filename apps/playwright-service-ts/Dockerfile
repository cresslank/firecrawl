# syntax=docker/dockerfile:1
FROM node:22.23.4-trixie-slim@sha256:817bd9409161864cc85fcda5febd87a26f2d47c9fe5af355d327aeddfa11602c AS base

# See apps/api/Dockerfile: this network blackholes Debian's default APT UA.
RUN printf 'Acquire::http::User-Agent "Debian docker-build";\n' > /etc/apt/apt.conf.d/99user-agent

ARG GIT_SHA
RUN printf '%s\n' "$GIT_SHA" | grep -Eq '^[0-9a-f]{40}$'
LABEL org.opencontainers.image.revision=$GIT_SHA

WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV CI=true

# Chromium comes from Debian trixie-security, not Playwright's browser download.
# Playwright's bundled build only moves when Playwright ships a release, so it
# can trail Chrome's security fixes by weeks, and image scanners cannot see it.
# As a dpkg package it is upgraded on every rebuild and covered by the image
# scan gate. The floor is the first build with Chrome's 2026-10-29 fixes.
ARG CHROMIUM_MIN_VERSION=156.0.8078.79
RUN set -eu; \
    apt-get update; \
    apt-get install -y --no-install-recommends chromium \
        fonts-freefont-ttf fonts-ipafont-gothic fonts-liberation \
        fonts-noto-color-emoji fonts-tlwg-loma-otf fonts-unifont fonts-wqy-zenhei; \
    apt-get upgrade -y; \
    rm -rf /var/lib/apt/lists/*; \
    version=$(dpkg-query -W -f='${Version}' chromium); \
    if ! dpkg --compare-versions "$version" ge "$CHROMIUM_MIN_VERSION"; then \
        echo "chromium $version is older than $CHROMIUM_MIN_VERSION" >&2; exit 1; \
    fi; \
    /usr/lib/chromium/chromium --version
ENV CHROMIUM_EXECUTABLE_PATH=/usr/lib/chromium/chromium

RUN corepack enable && corepack prepare pnpm@11.15.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=firecrawl-playwright-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm run build
RUN pnpm prune --prod && \
    rm -rf /pnpm/store /root/.cache /root/.local/share/pnpm \
        /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg

RUN chown -R node:node /usr/src/app

ARG PORT
ENV PORT=${PORT}

EXPOSE ${PORT}

USER node

CMD ["node", "dist/api.js"]
