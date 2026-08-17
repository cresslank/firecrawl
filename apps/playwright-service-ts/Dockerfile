# syntax=docker/dockerfile:1
FROM node:22.23.1-trixie-slim@sha256:e6d9a389d34ff9678438af985c9913fbd1eb6ed36e80fea56644f4b4f6dd70ba AS base

# See apps/api/Dockerfile: this network blackholes Debian's default APT UA.
RUN printf 'Acquire::http::User-Agent "Debian docker-build";\n' > /etc/apt/apt.conf.d/99user-agent

ARG GIT_SHA=unknown
LABEL org.opencontainers.image.revision=$GIT_SHA

WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright
ENV CI=true

RUN corepack enable && corepack prepare pnpm@11.15.1 --activate

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=firecrawl-playwright-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

# Install Playwright browser and OS dependencies after the locked install.
RUN pnpm exec playwright install chromium --with-deps
RUN apt-get update && apt-get upgrade -y && rm -rf /var/lib/apt/lists/*

RUN pnpm run build
RUN pnpm prune --prod && \
    rm -rf /pnpm/store /root/.cache /root/.local/share/pnpm \
        /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
        /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
        /usr/local/bin/pnpm /usr/local/bin/pnpx /usr/local/bin/yarn /usr/local/bin/yarnpkg

RUN chown -R node:node /usr/src/app \
  && chmod -R a+rX /usr/local/share/playwright

ARG PORT
ENV PORT=${PORT}

EXPOSE ${PORT}

USER node

CMD ["node", "dist/api.js"]
