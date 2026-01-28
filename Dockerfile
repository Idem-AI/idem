FROM node:20.18-alpine

WORKDIR /app

# 复制 package.json 和 pnpm-lock.yaml
COPY . .

# 设置 npm 配置并安装依赖
RUN npm install -g pnpm && \
    pnpm install


RUN pnpm build

# 设置环境变量
ENV NODE_ENV=production

# 暴露端口
EXPOSE 3000
# 启动命令
CMD ["pnpm", "start"]
