# NameArena 生产镜像
# 构建上下文 = 仓库根目录：docker compose build
# 国内网络：拉基础镜像失败时先配置 Docker 镜像加速，或
#   docker pull docker.m.daocloud.io/library/node:22-slim && docker tag ... node:22-slim

# ---------- 阶段一：安装依赖 + 构建前端 ----------
FROM node:22-slim AS deps
RUN corepack enable && npm config set registry https://registry.npmmirror.com
# better-sqlite3 的预编译二进制走 npmmirror；拉不到时用工具链本地编译兜底
ENV better_sqlite3_binary_host_mirror=https://registry.npmmirror.com/-/binary/better-sqlite3
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY apps/server/package.json apps/server/
COPY apps/web/package.json apps/web/
COPY scripts/package.json scripts/
# pnpm 版本由根 package.json 的 packageManager 字段锁定（corepack 自动切换）
RUN pnpm install --frozen-lockfile

COPY packages ./packages
COPY apps ./apps
COPY scripts ./scripts
RUN pnpm --filter web build

# ---------- 阶段二：干净运行时 ----------
FROM node:22-slim
WORKDIR /app
# 原生模块（better-sqlite3）已在 deps 阶段编译为 linux/glibc 二进制，整体拷贝即可用
COPY --from=deps /app /app

ENV NODE_ENV=production
# 数据库文件目录（compose 中挂载为卷持久化）
VOLUME ["/app/apps/server/data"]
EXPOSE 8787

WORKDIR /app/apps/server
# seed 幂等：已有数据时自动跳过
CMD ["sh", "-c", "./node_modules/.bin/tsx src/seed.ts && ./node_modules/.bin/tsx src/main.ts"]
