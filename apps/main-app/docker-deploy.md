
# 🐳 Deployment Guide — Dockerized Setup for IDEM

This guide provides step-by-step instructions to run the **IDEM Web Generator** and its associated services using **Docker** and **Docker Compose**.


## ⚙️ Prerequisites

Ensure the following are installed on your system:

- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)
- A copy of your `.env` file with required secrets

---

## 📄 Environment Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
````

2. Fill in the `.env` file with your personal configuration:

* 🔐 Firebase credentials
* 🔑 API keys (OpenRouter, Gemini, DeepSeek, etc.)
* 🌐 API URLs


---

## 🛠️ Build and Run the Application

To start all containers:

```bash
docker-compose up --build -d
```

This will spin up the following services:

| Service       | Port      | Description                            |
| ------------- | --------- | -------------------------------------- |
| `idem`        | `80`      | Angular frontend                       |
| `idem-api`    | `3000`    | Node.js backend with AI integrations   |
| `idem-webgen` | `5173`    | Vite dev server for IDEM Web Generator |
| `idem-chart`  | `8040`    | Mermaid live editor (chart renderer)   |

---

## 🧪 Test Locally

Visit the following URLs in your browser:
* IDEM FRONTEND SERVICE : [http://localhost](http://localhost)
* IDEM Web Generator: [http://localhost:5173](http://localhost:5173)
* Mermaid Chart Editor: [http://localhost:8040](http://localhost:8040)
* Backend API (if configured on port 3000): [http://localhost:3000](http://localhost:3000)

---

## ♻️ Lifecycle Commands

Rebuild containers if the code changes:

```bash
docker-compose up --build -d
```

Restart services:

```bash
docker-compose restart
```

Stop all services:

```bash
docker-compose down
```

