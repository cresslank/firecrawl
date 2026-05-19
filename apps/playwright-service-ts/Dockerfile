# syntax=docker/dockerfile:1
FROM node:22.22.3-trixie-slim@sha256:02684a61c3e87ae3e9ec7ef98e312a6ec35483644e204e80fc053648c3e87d75 AS base

WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright
ENV CI=true

RUN corepack enable

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

ARG PORT
ENV PORT=${PORT}

EXPOSE ${PORT}

CMD ["node", "dist/api.js"]
