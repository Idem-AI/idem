FROM docker.m.daocloud.io/library/node:20.18

WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY apps/we-dev-next/package.json ./
COPY apps/we-dev-next/pnpm-lock.yaml ./
COPY apps/we-dev-next/.env.prod ./.env

# 设置 npm 配置并安装依赖
RUN npm config set registry https://registry.npmmirror.com/ && \
    npm install -g pnpm && \
    pnpm config set registry https://registry.npmmirror.com && \
    pnpm config set strict-ssl false && \
    pnpm install

# 复制项目文件
COPY apps/we-dev-next/ ./

# 构建应用
RUN pnpm build

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=3000

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["pnpm", "start"]
