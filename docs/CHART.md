# Technical Documentation — Diagram Editor (Chart)

This document describes the technical configuration and development parameters of the Svelte Diagram Editor (**idem-chart**), located in `apps/chart`.

---

## 🚀 Overview

The Diagram Editor is a specialized visual mapping module. It uses Mermaid.js and Svelte Kit to convert text declarations into flowcharts, sequence diagrams, Gantt charts, and UML representations. It allows instant live previews, SVG/PNG outputs, and collaborative link sharing.

---

## 🛠️ Stack & Technologies

- **Frontend Framework**: Svelte Kit (Svelte 5)
- **Diagram Interpreter**: Mermaid.js
- **Styling**: Tailwind CSS & Lucide Icons
- **Bundler**: Vite
- **Deployment Platform**: Netlify
- **Package Manager**: pnpm

---

## ⚙️ Configuration & Environment Arguments

The Svelte compiler extracts specific properties at compile time or reads them from the `.env` configuration file located in `apps/chart/.env`.

| Parameter | Build Argument | Default Value | Description |
| :--- | :--- | :--- | :--- |
| `VITE_MERMAID_RENDERER_URL` | `MERMAID_RENDERER_URL` | `https://mermaid.ink` | Target endpoint for rendering diagrams to images. Set empty to disable PNG/SVG action downloads. |
| `VITE_MERMAID_KROKI_RENDERER_URL`| `MERMAID_KROKI_RENDERER_URL` | `https://kroki.io` | Custom Kroki instance for rendering. Set empty to disable action. |
| `VITE_MERMAID_DOMAIN` | `MERMAID_DOMAIN` | *(None)* | Tracked domain name for Plausible analytics. |
| `VITE_MERMAID_ANALYTICS_URL` | `MERMAID_ANALYTICS_URL` | *(None)* | Plausible analytics target url instance. |
| `VITE_MERMAID_IS_ENABLED_MERMAID_CHART_LINKS` | `MERMAID_IS_ENABLED_MERMAID_CHART_LINKS`| *(None)* | Set to `true` to enable saving diagrams and show promotions. |

---

## 🐳 Docker Deployment

The application compiles static web layers running on top of an Nginx webserver.

### Pre-built Execution
```bash
# Pull and execute on host port 8000
docker run --platform linux/amd64 --publish 8000:8080 ghcr.io/idem-js/idem-chart
```

### Local Build & Execution
```bash
# Build local docker tag
docker build -t idem-js/idem-chart .

# Run container in background mapping port 8080
docker run --detach --name idem-chart --publish 8080:8080 idem-js/idem-chart

# Stop container
docker stop idem-chart
```

---

## 🔧 Operations Scripts

To run commands inside `apps/chart/`:

```bash
# Install dependencies
pnpm install

# Start local hot-reload server (opens default browser)
pnpm dev -- --open

# Execute linting checks
pnpm lint

# Compile static distribution bundle
pnpm build
```
The compiled assets are generated inside `apps/chart/dist/` (or `.svelte-kit/` output directory depending on static configuration adapter).
