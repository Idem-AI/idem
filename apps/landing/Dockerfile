# Dockerfile
FROM node:20-alpine AS builder

WORKDIR /app

RUN npm install -g npm@latest

# Copier les fichiers de dépendances
COPY package.json package-lock.json ./

# Installer les dépendances
RUN npm ci --legacy-peer-deps

# Copier le code source
COPY . .

# Build toutes les locales
RUN npm run build:all-locales

# Stage de production avec nginx
FROM nginx:alpine AS production

# Copier la configuration nginx personnalisée
COPY nginx.conf /etc/nginx/nginx.conf

# Copier les builds des deux locales
COPY --from=builder /app/dist/landing/browser/en-US /usr/share/nginx/html/en
COPY --from=builder /app/dist/landing/browser/fr /usr/share/nginx/html/fr

# Copier la version française comme défaut
COPY --from=builder /app/dist/landing/browser/fr /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
