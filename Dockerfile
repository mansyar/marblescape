# ---- Build stage: produce the static site with the exact pinned toolchain ----
FROM node:24-alpine AS build
RUN corepack enable
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN corepack prepare pnpm@11.24.0 --activate && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

# ---- Runtime stage: nginx serving the static site ----
FROM nginx:alpine AS runtime
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/ || exit 1
CMD ["nginx", "-g", "daemon off;"]