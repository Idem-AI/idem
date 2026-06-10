# Technical Documentation — Express API Backend

This document details the configuration, architecture, and API endpoints of the central backend service (**idem-api**), located in `apps/api`.

---

## 🚀 Overview

The Central API serves as the orchestration layer for AI SDLC services. It interfaces with external intelligence models (Gemini, OpenAI), coordinates storage with Firebase and MinIO, enforces rate limiting and usage quotas, and serves authenticated endpoints to the main dashboard.

---

## 🛠️ Stack & Technologies

- **Runtime**: Node.js & TypeScript
- **Framework**: Express.js
- **Primary Database**: Firebase Firestore
- **Blob Object Storage**: MinIO (S3-compatible)
- **Authentification**: Firebase Authentication (Admin SDK)
- **AI Providers**: Google Gemini SDK (`@google/generative-ai`) and OpenAI SDK
- **Logging**: Winston logger (structured files and console logs)
- **Shared packages**: `@idem/shared-models` & `@idem/shared-auth-client`

---

## 📁 Project Structure

```
apps/api/
├── api/
│   ├── controllers/      # HTTP handlers extracting params and calling services
│   ├── models/           # TypeScript structure schemas & validation
│   ├── routes/           # Routing middleware and endpoint maps
│   └── services/         # Business logic and AI interaction clients
├── dist/                 # Compiled JavaScript output
├── firebase-key.json     # Service account credentials (ignored in production)
├── package.json          # Node dependencies & project scripts
└── tsconfig.json         # TypeScript compiler rules
```

---

## ⚙️ Environment Variables

The backend application expects configuration defined in a `.env` file at `apps/api/.env`.

| Key | Example Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | Listen port for local server |
| `NODE_ENV` | `development` | Server runtime environment mode |
| `GOOGLE_API_KEY` | `AIzaSy...` | API key for Gemini models |
| `OPENAI_API_KEY` | `sk-...` | API key for OpenAI models |
| `FIREBASE_PROJECT_ID` | `lexis-ia` | Firebase/Firestore target project ID |
| `MINIO_ENDPOINT` | `localhost` | MinIO target hostname |
| `MINIO_PORT` | `9000` | MinIO service port |
| `MINIO_ACCESS_KEY` | `minioadmin` | Access credentials key for MinIO |
| `MINIO_SECRET_KEY` | `minioadmin123` | Secret credentials key for MinIO |
| `DAILY_QUOTA_LIMIT` | `50` | Maximum daily requests per user |
| `CORS_ALLOWED_ORIGINS`| `http://localhost:4200` | Allowed origins list |

---

## 🔌 Core API Endpoints

### 📁 Projects Management
- `GET /projects` — Retrieve all projects for the authenticated user.
- `GET /projects/:projectId` — Retrieve detailed metadata for a single project.
- `POST /projects` — Register a new project workspace.
- `PUT /projects/:projectId` — Edit title, description, or configuration.
- `DELETE /projects/:projectId` — Hard-delete project and sub-entities.
- `GET /projects/:projectId/agentic` — Retrieve generated code payload as a ZIP archive.

### 📊 Business Plans
- `POST /planning/business-plans` — Initiate multi-turn AI generation of a business plan.
- `GET /planning/business-plans/:id` — Retrieve generated plan sections.
- `PUT /planning/business-plans/:id` — Update or review individual steps.
- `DELETE /planning/business-plans/:id` — Purge plan data.

### 🎨 Branding
- `POST /branding/logos` — Run text-to-image or styling AI to generate a brand identity/logo.
- `GET /branding/logos/:id` — Retrieve generated layout.

### 📊 System Diagrams
- `POST /diagrams` — Generate structured Mermaid UML code from project descriptions.
- `GET /diagrams/:id` — Retrieve UML diagram code structure.

---

## ⚙️ Development Scripts

To run commands within the `/apps/api` folder:

```bash
# Start in development mode (hot reloading via nodemon/ts-node)
npm run dev

# Compile TypeScript into JavaScript
npm run build

# Start production server
npm run start
```
