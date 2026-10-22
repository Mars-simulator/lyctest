# 说明：未使用 `# syntax=docker/dockerfile:1`，避免构建时额外拉取 Dockerfile 前端镜像（离线/受限网络更友好）

# =========================================================
# 构建阶段：安装全部依赖并编译 TypeScript
# =========================================================
FROM node:24-alpine AS builder
WORKDIR /app

# 先复制依赖清单，命中层缓存（源码变更时无需重装依赖）
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

# nest build 依赖 nest-cli.json 与 tsconfig.build.json
COPY tsconfig.json tsconfig.build.json nest-cli.json ./
COPY src ./src
RUN npm run build

# =========================================================
# 运行阶段：仅保留生产依赖与编译产物
# =========================================================
FROM node:24-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# 只装生产依赖，显著减小镜像体积
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund && npm cache clean --force

COPY --from=builder /app/dist ./dist

# 以非 root 用户运行
USER node

EXPOSE 3000

# 使用 Node 内置 fetch 探活，镜像内无需额外安装 curl / wget
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# 直接运行编译产物；Nest 已开启 shutdown hooks，可响应 SIGTERM 优雅退出
CMD ["node", "dist/main.js"]
