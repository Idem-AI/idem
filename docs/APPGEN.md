# Technical Documentation — App Generator (Appgen)

This document contains technical details, configurations, and scripts for the **App Generator** service (`apps/appgen`), also referred to as **we-dev**.

---

## 🚀 Overview

The App Generator is an advanced project designer and debugger. Unlike standard AI-assisted template creators, this application integrates a client-side execution container (WebContainer) allowing a terminal environment, design restoration rules, and connection interfaces for developer platforms.

---

## ✨ Key Differentiator Features

1. **Browser Debugging (WebContainer)**: Spawns an internal terminal simulation direct inside the browser to download npm packages, execute development compilers, and preview outcomes.
2. **Design-to-Code (D2C)**: High-fidelity visual restoration mapping image mocks directly to structured components with up to 90% translation accuracy.
3. **Local Import Support**: Capability to import and read historical projects, allowing users to modify existing codebases directly inside the system.
4. **WeChat Developer Interface**: Built-in support to trigger and preview files directly within WeChat Mini Program Developer Tools.
5. **AI Integration**: Support for OpenAI, DeepSeek, Gemini, and MCP server systems.

---

## 📁 Repository Structure

```
apps/appgen/
├── apps/
│   ├── we-dev-client/      # Client-side React app interface
│   ├── we-dev-next/        # Next.js backend runner service
│   └── we-dev-admin/       # Admin console (if present)
├── scripts/
│   └── wedev-build.sh      # Web Editor build orchestration script
├── package.json            # Monorepo pnpm project configuration
└── tsconfig.json           # Compiler variables configuration
```

---

## ⚙️ Environment Variables

The project contains two separate configuration contexts:

### Client configuration (`apps/appgen/apps/we-dev-client/.env`)
- `REACT_APP_BASE_URL` — Target endpoint of the Appgen Next server (e.g. `http://localhost:3000`).
- `REACT_APP_IDEM_API_BASE_URL` — Target endpoint of the main API server (e.g. `http://localhost:3001`).
- `REACT_APP_IDEM_MAIN_APP_URL` — Landing redirect URL (e.g. `http://localhost:4200`).
- `JWT_SECRET` — Client JWT signature (optional).

### Server configuration (`apps/appgen/apps/we-dev-next/.env`)
- `THIRD_API_URL` — Third party model provider (e.g. `https://api.openai.com/v1`).
- `THIRD_API_KEY` — API credentials key.
- `JWT_SECRET` — Server authorization secret.

---

## 🔧 Operations & Compilation

To compile the entire App Generator bundle, execute:

```bash
# Set permissions on the builder
chmod +x scripts/wedev-build.sh

# Run compilation
./scripts/wedev-build.sh
```

### Dev Scripts
To run the components individually:

- Client dev server: `pnpm run dev --filter=we-dev-client` (or root runner: `npm run dev:appgen-client`).
- Server dev server: `pnpm run dev --filter=we-dev-next` (or root runner: `npm run dev:appgen-next`).
