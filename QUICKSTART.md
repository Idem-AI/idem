# 🚀 Quick Start - Idem Workspace

Quick start guide to begin working with the Idem workspace.

## ⚡ Quick Installation

```bash
# 1. Install all dependencies
./scripts/setup.sh

# OR manually
npm install
```

## 🎯 Launch a Project

### Option 1: NPM Commands (Recommended)

```bash
# Angular Application
npm run dev:ai

# Mermaid Editor (Svelte)
npm run dev:chart

# App Generator (React)
npm run dev:appgen

# Backend API
npm run dev:api

# Launch everything in parallel
npm run dev:all
```

### Option 2: Direct NX Commands

```bash
nx run idem-ai:serve
nx run idem-ai-chart:dev
nx run idem-appgen:dev
nx run idem-api:dev
```

## 📦 Build

```bash
# Build a specific project
npm run build:ai
npm run build:chart
npm run build:appgen
npm run build:api

# Build all projects
npm run build:all

# Build only modified projects (FAST ⚡)
npm run build:affected
```

## 🧪 Tests

```bash
# Test all projects
npm run test:all

# Test only modified projects (FAST ⚡)
npm run test:affected
```

## 🎨 Linting & Formatting

```bash
# Lint all code
npm run lint:all

# Auto-fix
npm run lint:fix

# Format code
npm run format
```

## 📊 Visualization

```bash
# View dependency graph
npm run graph

# View projects affected by your changes
npm run affected:graph
```

## 🛠️ Useful Commands

```bash
# Clean NX cache
npm run reset

# Clean all projects
npm run clean

# Reinstall everything
./scripts/clean.sh
./scripts/setup.sh
```

## 📚 Complete Documentation

- **[README.md](./README.md)** - Main documentation
- **[NPM_WORKSPACES_GUIDE.md](./documentation/NPM_WORKSPACES_GUIDE.md)** - Complete npm workspaces guide
- **[MIGRATION.md](./MIGRATION.md)** - Migration guide

## 💡 Tips

### 1. Use npm Workspaces

Native npm workspace management for simplicity.

### 2. Run Specific Projects

```bash
# Instead of running everything
npm run dev:all

# Run only what you need
npm run dev:ai
```

### 3. Keep Dependencies Updated

Regularly update dependencies for security and performance.

### 4. Use Scripts

```bash
./scripts/setup.sh  # Quick setup
./scripts/clean.sh  # Clean workspace
```

Automated scripts for common tasks.

## 🆘 Problems?

```bash
# Corrupted cache?
npm run reset

# Missing dependencies?
./scripts/setup.sh

# Build errors?
npm run clean
npm run build:all
```

## 🎓 Learn More

1. Read [NPM_WORKSPACES_GUIDE.md](./documentation/NPM_WORKSPACES_GUIDE.md) for everything
2. Explore with `npm run` to see available scripts
3. Check the documentation folder for guides

---

**Ready to code!** 🚀
