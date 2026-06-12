# Idem Project Architecture

## Global Architecture Diagram

```mermaid
flowchart TB
    subgraph "User Layer"
        User[User]
    end

    subgraph "Public Facing"
        Landing[Landing Page<br/>Angular 20 + SSR<br/>Port: 4201]
    end

    subgraph "Private Dashboard"
        Dashboard[Main Dashboard<br/>Angular 20<br/>Port: 4200]
    end

    subgraph "AI Generation Tools"
        Chart[Chart Editor<br/>Svelte 5<br/>Port: 5173]
        AppGen[App Generator<br/>Next.js + Vite<br/>Port: 3000/5173]
    end

    subgraph "Backend Services"
        API[Central API<br/>Express + TS<br/>Port: 3001]
        Firebase[Firebase<br/>Auth + Firestore]
        MinIO[MinIO<br/>Storage]
        AI[AI Services<br/>Gemini + OpenAI]
    end

    subgraph "Deployment"
        Ideploy[Ideploy<br/>Laravel + React<br/>Port: 8000]
    end

    subgraph "Shared Packages"
        SharedModels[Shared Models<br/>TypeScript]
        SharedAuth[Shared Auth Client<br/>TypeScript]
        SharedStyles[Shared Styles<br/>Tailwind CSS]
    end

    User --> Landing
    User --> Dashboard
    Landing --> Dashboard
    Dashboard --> Chart
    Dashboard --> AppGen
    Dashboard --> API
    Chart --> API
    AppGen --> API
    Ideploy --> API
    API --> Firebase
    API --> MinIO
    API --> AI
    Dashboard --> SharedModels
    API --> SharedModels
    AppGen --> SharedModels
    Ideploy --> SharedModels
    Dashboard --> SharedAuth
    API --> SharedAuth
    Ideploy --> SharedAuth
    Landing --> SharedStyles
    Dashboard --> SharedStyles
    AppGen --> SharedStyles

    style Landing fill:#e1f5ff
    style Dashboard fill:#fff4e1
    style Chart fill:#f3e5f5
    style AppGen fill:#e8f5e9
    style API fill:#ffebee
    style Ideploy fill:#fce4ec
    style SharedModels fill:#f5f5f5
    style SharedAuth fill:#f5f5f5
    style SharedStyles fill:#f5f5f5
```

## Architecture Overview

The Idem project is a monorepo organized around a central API that coordinates multiple frontend applications and shared packages.

**User Layer:** Users interact with either the public Landing Page or the private Main Dashboard. The Landing Page handles public content and authentication, then redirects users to the Dashboard for their private workspace.

**Frontend Applications:**

- The Main Dashboard is the primary interface for project management, AI generation workflows, and team collaboration
- The Chart Editor provides interactive diagram editing capabilities
- The App Generator creates complete applications using AI

**Backend Services:**

- The Central API acts as the hub, handling authentication, AI generation requests, and data persistence
- Firebase provides authentication and database services
- MinIO handles file storage
- AI Services (Gemini and OpenAI) power the generation capabilities

**Deployment:** Ideploy is a self-hosted deployment platform that can deploy applications created through the system.

**Shared Packages:** Three TypeScript packages provide common functionality across all applications:

- Shared Models: Unified data models
- Shared Auth Client: Authentication client
- Shared Styles: Design system with Tailwind CSS

All frontend applications communicate with the Central API, which in turn interfaces with external services (Firebase, MinIO, AI providers). Shared packages ensure consistency and reduce code duplication across the ecosystem.
