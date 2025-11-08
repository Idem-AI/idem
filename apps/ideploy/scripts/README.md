# Ideploy Scripts

Collection of scripts for managing the Ideploy (Coolify fork) application.

## Development Scripts

### 🚀 Quick Start

```bash
# Complete setup (recommended for first-time setup)
./scripts/run-local.sh

# Verify setup
./scripts/verify-setup.sh

# Start all services
./scripts/start-all.sh

# Stop all services
./scripts/stop-all.sh
```

## Script Descriptions

### `run-local.sh`

**Complete local development setup**

This script performs a full setup of the development environment:

- Checks and validates all dependencies (PHP, Composer, PostgreSQL, Redis, Node.js)
- Creates `.env` file from `.env.local` if needed
- Starts PostgreSQL and Redis services
- Creates the database
- Installs PHP and Node.js dependencies
- Generates application key
- **Runs migrations**
- **Seeds the database with initial data** (including InstanceSettings)
- Creates storage symlink
- Builds frontend assets

**Usage:**

```bash
./scripts/run-local.sh
```

**When to use:**

- First-time setup
- After pulling major changes
- When database needs to be reset
- When dependencies are out of sync

### `verify-setup.sh`

**Verify development environment configuration**

Checks that everything is properly configured:

- ✅ `.env` file exists and is valid
- ✅ Database connection works
- ✅ Migrations are executed
- ✅ InstanceSettings record exists (ID: 0)
- ✅ Redis is running
- ✅ Dependencies are installed
- ✅ Storage symlink is created

**Usage:**

```bash
./scripts/verify-setup.sh
```

**When to use:**

- Before starting services
- After setup to verify everything works
- When troubleshooting issues
- After database changes

### `start-all.sh`

**Start all services in background**

Starts all required services as background processes:

- Web server (port 8000)
- Queue worker
- Horizon (Laravel queue dashboard)
- Vite dev server (optional, with `--dev` flag)

**Usage:**

```bash
# Start all services
./scripts/start-all.sh

# Start with Vite dev server
./scripts/start-all.sh --dev
```

**Features:**

- Checks database initialization before starting
- Logs all output to `storage/logs/services/`
- Stores PIDs for easy management
- Provides helpful URLs and commands

**Logs:**

```bash
tail -f storage/logs/services/web.log
tail -f storage/logs/services/queue.log
tail -f storage/logs/services/horizon.log
```

### `stop-all.sh`

**Stop all running services**

Gracefully stops all services started by `start-all.sh`:

- Reads PIDs from `storage/logs/services/*.pid`
- Sends SIGTERM to each process
- Cleans up PID files

**Usage:**

```bash
./scripts/stop-all.sh
```

## Common Workflows

### First-Time Setup

```bash
# 1. Complete setup
./scripts/run-local.sh

# 2. Verify everything works
./scripts/verify-setup.sh

# 3. Start services
./scripts/start-all.sh

# 4. Access the application
open http://localhost:8000
```

### Daily Development

```bash
# Start services
./scripts/start-all.sh --dev

# Work on your features...

# Stop services when done
./scripts/stop-all.sh
```

### After Pulling Changes

```bash
# Stop services
./scripts/stop-all.sh

# Update dependencies and database
composer install
npm install
php artisan migrate

# Verify setup
./scripts/verify-setup.sh

# Restart services
./scripts/start-all.sh
```

### Database Reset

```bash
# Stop services
./scripts/stop-all.sh

# Reset database
php artisan migrate:fresh --seed

# Verify
./scripts/verify-setup.sh

# Restart
./scripts/start-all.sh
```

## Troubleshooting

### Error: "No query results for model [App\Models\InstanceSettings] 0"

**Cause:** The database hasn't been seeded with the required InstanceSettings record.

**Solution:**

```bash
# Option 1: Seed just InstanceSettings
php artisan db:seed --class=InstanceSettingsSeeder

# Option 2: Reset and seed everything
php artisan migrate:fresh --seed

# Option 3: Run complete setup
./scripts/run-local.sh
```

### Services Won't Start

**Check database:**

```bash
./scripts/verify-setup.sh
```

**Check logs:**

```bash
tail -f storage/logs/services/web.log
```

**Restart services:**

```bash
./scripts/stop-all.sh
./scripts/start-all.sh
```

### Database Connection Issues

**Check PostgreSQL:**

```bash
brew services list | grep postgresql
brew services start postgresql@15
```

**Verify connection:**

```bash
psql -U $(whoami) -l
```

### Redis Issues

**Check Redis:**

```bash
redis-cli ping
brew services start redis
```

## Environment Requirements

- **PHP:** 8.2 or higher
- **Composer:** Latest version
- **PostgreSQL:** 15 or higher
- **Redis:** Latest version
- **Node.js:** 18 or higher
- **npm:** Latest version

## Installation

All scripts are located in the `scripts/` directory and should be executed from the project root:

```bash
cd /path/to/ideploy
./scripts/script-name.sh
```

## Service URLs

After starting services with `start-all.sh`:

- **Application:** http://localhost:8000
- **Horizon Dashboard:** http://localhost:8000/horizon
- **Vite Dev Server:** http://localhost:5173 (if started with `--dev`)

## Log Files

All service logs are stored in `storage/logs/services/`:

- `web.log` - Web server output
- `queue.log` - Queue worker output
- `horizon.log` - Horizon output
- `vite.log` - Vite dev server output (if started)

## PID Files

Process IDs are stored in `storage/logs/services/`:

- `web.pid`
- `queue.pid`
- `horizon.pid`
- `vite.pid`

## Additional Resources

- **Database Setup Guide:** See `DATABASE_SETUP.md` in the project root
- **Laravel Documentation:** https://laravel.com/docs
- **Coolify Documentation:** https://coolify.io/docs
