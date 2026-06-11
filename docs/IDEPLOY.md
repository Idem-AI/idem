# Technical Documentation — iDeploy (ideploy)

This document outlines the technical architecture, security layout, and operations for the **iDeploy** application, located in `apps/ideploy`.

---

## 🚀 Overview

iDeploy is an open-source, self-hostable alternative to Heroku, Vercel, and Netlify. Built on top of a customized version of Coolify, it manages application deployments across multi-environments (development, staging, production) directly connecting to Git targets. It features deep integration with CrowdSec and Traefik for security enforcement and firewall rule compilation.

---

## 🏛️ Security & Network Flow

Traffic passes through multiple security and logging filters before hitting the deploy services:

```
Application Traffic → Traefik Reverse Proxy → CrowdSec WAF → Traffic Logger → Virtual Server
```

---

## 🛠️ Stack & Technologies

- **Backend Framework**: Laravel 11 (PHP)
- **Frontend Interaction**: Livewire 3 / React (Vite)
- **Database**: PostgreSQL (running locally or in container)
- **Task Queue & Caching**: Redis
- **Security Engine**: CrowdSec WAF integration
- **Load Balancer**: Traefik Proxy with automatic SSL termination
- **WebSocket server**: Soketi (realtime websocket client integration)

---

## ⚙️ Environment Variables

The project utilizes environment parameters defined in `apps/ideploy/.env`.

### General Laravel Variables
- `APP_NAME` — App title (`iDeploy` / `Coolify Dev`).
- `APP_ENV` — Local or production flag.
- `APP_KEY` — Unique encryption key (generated via artisan).
- `APP_URL` — Address endpoint (e.g. `http://localhost:8000`).

### Database & Cache
- `DB_CONNECTION` — Typically `pgsql`.
- `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` — Database credentials mapping local postgres container.
- `REDIS_HOST`, `REDIS_PORT` — Redis credentials mapping local redis container.

### IDEM Integrations & JWT
- `IDEM_API_URL` — Target endpoint of main Express API (e.g. `http://api:3000` or `http://localhost:3001`).
- `JWT_SECRET` — Shared signature token enabling secure communication.
- `PUSHER_HOST`, `PUSHER_PORT` — Socket credentials routing to Soketi WebSocket container.

---

## 🔧 Operations Commands

### Standard Development Execution
To run iDeploy locally without Docker orchestration:

```bash
# Generate unique app key
php artisan key:generate

# Execute database structure migrations
php artisan migrate

# Start local server
php artisan serve

# Build and monitor asset compilation
npm run dev

# Spin up queue workers
php artisan queue:work
```

### Clean Scripts
- `./scripts/clean-all.sh` — Clear Laravel view caches, routes, temporary logs, bootstrap compilation, and reset dev cache.
