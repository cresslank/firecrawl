# syntax=docker/dockerfile:1
FROM node:18.20.8-slim@sha256:f9ab18e354e6855ae56ef2b290dd225c1e51a564f87584b9bd21dd651838830e AS base

WORKDIR /usr/src/app

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV PLAYWRIGHT_BROWSERS_PATH=/usr/local/share/playwright
ENV CI=true

RUN corepack enable

COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,id=firecrawl-playwright-pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY . .

# Install Playwright browser and OS dependencies after the locked install.
RUN pnpm exec playwright install chromium --with-deps

RUN pnpm run build
RUN pnpm prune --prod

ARG PORT
ENV PORT=${PORT}

EXPOSE ${PORT}

CMD ["node", "dist/api.js"]
