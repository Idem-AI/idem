FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install mermaid --save

RUN npm install && npm install -g npm@11.6.2
COPY . .

RUN node -r dotenv/config mynode.js

RUN npm run build -- --configuration=production


FROM node:20-alpine AS runner

WORKDIR /app

# Copier seulement ce qui est nécessaire depuis le builder
COPY --from=builder /app/dist/idem ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

EXPOSE 4000

# Lancer le serveur Angular SSR
CMD ["node", "dist/server/server.mjs"]
