# Build depuis la racine du monorepo :
#   docker build -f apps/backend/Dockerfile .
FROM node:22-alpine AS base
RUN npm install -g pnpm@12.3.1
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm fetch
COPY . .
RUN pnpm install --frozen-lockfile --offline --filter @pipou/backend...
RUN pnpm --filter @pipou/shared build && pnpm --filter @pipou/backend build
RUN pnpm deploy --filter @pipou/backend --prod /prod

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /prod ./
EXPOSE 3000
CMD ["node", "dist/main"]
