# Idem - AI-Powered Software Development Lifecycle Platform

<div align="center">
  <p><strong>Transform ideas into complete software projects with AI</strong></p>
</div>

[![License: Apache 2.0 + Commons Clause](https://img.shields.io/badge/License-Apache%202.0%20%2B%20Commons%20Clause-orange.svg)](./LICENSE)
[![npm workspaces](https://img.shields.io/badge/npm-workspaces-cb3837.svg)](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
[![Angular](https://img.shields.io/badge/Angular-20-dd0031.svg)](https://angular.dev/)
[![Non-Commercial](https://img.shields.io/badge/Usage-Non--Commercial-red.svg)](./LICENSE_FAQ.md)

> **🎯 New to the project?** Start with [START_HERE.md](./START_HERE.md) for a complete getting started guide!
>
> **📄 License Notice:** Idem is open source but **not for commercial use**. You can use it freely for internal purposes, but you cannot sell it or offer it as a paid service. See [LICENSE_FAQ.md](./LICENSE_FAQ.md) for details.

## 🚀 Overview

**Idem** is an open-source AI platform that allows you to start from your idea and make it a real project.

You simply write a few lines about what you want to create, and the tool generates your logo, your visual identity, your business plan, your showcase site, and even an application. Then, you have several options to deploy all this easily.

This monorepo workspace is managed with **npm workspaces** and contains four integrated applications that work together to provide a complete AI-powered development experience.

## ✨ Key Features

All features are powered by AI, generating the following software development lifecycle elements:

- **Business Plan Generation**: AI creates comprehensive business plans tailored to your software project
- **Branding & Design**: AI designs logos and complete brand style guides based on your requirements
- **UML Analysis**: AI develops detailed UML diagrams and system architecture documentation
- **Interactive Diagram Editor**: Edit and preview flowcharts, sequence diagrams, and Gantt charts in real-time
- **Landing Page Creation**: AI designs responsive landing pages for your application
- **Project Generation**: AI builds full software projects based on your specifications
- **Documentation**: AI generates comprehensive technical documentation for your software
- **Deployment Management**: AI streamlines the deployment process across different environments

## 📦 Projects

This monorepo contains four main applications:

| Project           | Framework          | Description                                     | Port |
| ----------------- | ------------------ | ----------------------------------------------- | ---- |
| **idem-ai**       | Angular 20         | Main AI-powered SDLC generation application     | 4200 |
| **idem-chart** | Svelte 5           | Interactive Mermaid diagram editor module       | 5173 |
| **idem-appgen**   | React/Next.js      | AI-powered application generator                | 3000 |
| **idem-api**      | Express/TypeScript | Backend API for AI services and data management | 3001 |
| **idem-ideploy** | PHP & React | Open-source & self-hostable alternative to Heroku / Netlify / Vercel | 8000 |


### idem-ai (Angular)

The main frontend application providing the complete AI-powered software development lifecycle experience. Built with Angular 20, it offers an intuitive interface for generating business plans, branding, UML diagrams, and complete project structures.

### idem-ai-chart (Svelte)

A specialized diagram editor module built with Svelte 5 and Mermaid.js. Provides real-time editing, preview, and sharing capabilities for flowcharts, sequence diagrams, and other visual representations of software architecture.

### idem-appgen (React)

An AI-powered application generator that supports browser-based debugging with WebContainer, high-fidelity design restoration (90% accuracy), and integration with WeChat Mini Program Developer Tools. Supports existing project imports for secondary editing.

### idem-api (Express)

The backend API built with Express.js and TypeScript. Integrates with Firebase/Firestore for data storage, Google's Gemini and OpenAI for AI generation, and implements a flexible repository pattern for database abstraction.

## 🛠️ Tech Stack

- **npm workspaces** - Native monorepo management
- **Angular 20** - Main frontend framework
- **Svelte 5** - Reactive framework for diagram editor
- **React 18 / Next.js** - Application generator framework
- **Express** - Backend API framework
- **TypeScript** - Primary language across all projects
- **TailwindCSS** - Utility-first CSS framework
- **Mermaid.js** - Diagram generation and rendering
- **Firebase/Firestore** - Data storage and authentication
- **AI Services** - Google Gemini & OpenAI integration

## 🏁 Quick Start

### Prerequisites

- **Node.js** >= 18.0.0 ([Download](https://nodejs.org))
- **npm** >= 9.0.0 (included with Node.js)
- **pnpm** >= 8.15.4 (for idem-ai-chart and idem-appgen)
- **Git** for version control

### Installation

#### Automatic Setup (Recommended)

```bash
# Clone the repository
git clone <repository-url>
cd idem

# Run the setup script
chmod +x scripts/setup.sh
./scripts/setup.sh
```

#### Manual Setup

```bash
# Clone the repository
git clone <repository-url>
cd idem

# Install workspace dependencies
npm install

# Install project-specific dependencies
cd apps/idem-ai && npm install && cd ../..
cd apps/idemAI-api && npm install && cd ../..
cd apps/idem-ai-chart && pnpm install && cd ../..
cd apps/idem-appgen && pnpm install && cd ../..
```

### Running Applications

```bash
# Run individual projects
npm run dev:ai        # Angular application (http://localhost:4200)
npm run dev:chart     # Svelte diagram editor (http://localhost:5173)
npm run dev:appgen    # React app generator (http://localhost:3000)
npm run dev:api       # Express API (http://localhost:3001)

```

## 🔧 Main Commands

### Development

```bash
npm run dev:ai          # Launch idem-ai
npm run dev:chart       # Launch idem-ai-chart
npm run dev:appgen      # Launch idem-appgen
npm run dev:api         # Launch idem-api
```

### Build

```bash
npm run build:ai        # Build idem-ai
npm run build:chart     # Build idem-ai-chart
npm run build:appgen    # Build idem-appgen
npm run build:api       # Build idem-api
npm run build:all       # Build all projects
```

### Tests & Quality

```bash
npm run test:all        # Test all projects
npm run lint:all        # Lint all projects
npm run lint:fix        # Auto-fix linting errors
npm run format          # Format code with Prettier
npm run format:check    # Check code formatting
```

### Utilities

```bash
npm run clean           # Clean all projects
```

## 🏗️ Architecture

```
idem/
├── apps/
│   ├── idem-ai/              # Angular application
│   │   ├── src/
│   │   └── package.json
│   ├── idem-ai-chart/        # Svelte application
│   │   ├── src/
│   │   └── package.json
│   ├── idem-appgen/          # React applications
│   │   ├── apps/
│   │   │   ├── we-dev-next/
│   │   │   ├── we-dev-admin/
│   │   │   └── we-dev-client/
│   │   └── package.json
│   └── idemAI-api/           # Express API
│       ├── api/
│       └── package.json
├── scripts/
│   ├── setup.sh              # Installation script
│   └── clean.sh              # Cleanup script
├── documentation/
│   ├── INSTALLATION.md       # Detailed installation guide
│   └── NPM_WORKSPACES_GUIDE.md  # npm workspaces guide
├── package.json              # Workspace dependencies
├── tsconfig.base.json        # Shared TypeScript config
├── .eslintrc.json            # Shared ESLint config
└── .prettierrc               # Prettier configuration
```

## 🎯 Smart Deploy System

Idem uses an intelligent deployment system that automatically detects which applications have been modified and deploys only those applications. This saves time and resources by avoiding unnecessary deployments.

### How It Works

When you push to `main`, `dev`, or `master` branches:

1. **🔍 Detection**: The system automatically detects which apps in `/apps` have changes
2. **🚀 Selective Deploy**: Only modified applications are deployed
3. **📊 Summary**: A deployment summary shows which apps were deployed and which were skipped

### Example

```bash
# Only modify the API
git add apps/api/src/
git commit -m "feat: add new endpoint"
git push origin dev
# Result: Only the API is deployed ✅
```

For more details, see [documentation/SMART_DEPLOY.md](./documentation/SMART_DEPLOY.md)

## 🔄 Development Workflow

### 1. Clone and Install

```bash
git clone <repository-url>
cd idem
npm install
```

### 2. Develop

```bash
# Create a feature branch
git checkout -b feature/my-feature

# Launch the project
npm run dev:ai

# Make your changes...
```

### 3. Verify Before Commit

```bash
# Lint and format
npm run lint:all
npm run format

# Test
npm run test:all

# Build
npm run build:all
```

### 4. Commit and Push

```bash
git add .
git commit -m "feat: add my new feature"
git push origin feature/my-feature
```

## 🎯 NPM Scripts Reference

| Script    | Description                          |
| --------- | ------------------------------------ |
| `dev:*`   | Launch a project in development mode |
| `build:*` | Build a project                      |
| `test:*`  | Test one or multiple projects        |
| `lint:*`  | Lint the code                        |
| `format`  | Format code with Prettier            |
| `clean`   | Clean builds                         |

## 🔍 Useful npm Workspaces Commands

```bash
# Run a command in a specific workspace
npm run <script> --workspace=<workspace-name>

# Run a command in all workspaces
npm run <script> --workspaces --if-present

# Install a dependency in a specific workspace
npm install <package> --workspace=<workspace-name>

# List all workspaces
npm ls --workspaces
```

## 📚 Documentation

- **[QUICKSTART.md](./QUICKSTART.md)** - Quick start guide
- **[documentation/README.md](./documentation/README.md)** - Documentation index
- **[documentation/SMART_DEPLOY.md](./documentation/SMART_DEPLOY.md)** - Smart Deploy system guide
- **[documentation/NPM_WORKSPACES_GUIDE.md](./documentation/NPM_WORKSPACES_GUIDE.md)** - npm workspaces guide
- **[apps/idem-ai/README.md](./apps/idem-ai/README.md)** - idem-ai documentation
- **[apps/idem-ai-chart/README.md](./apps/idem-ai-chart/README.md)** - idem-ai-chart documentation
- **[apps/idem-appgen/README.md](./apps/idem-appgen/README.md)** - idem-appgen documentation
- **[apps/idemAI-api/README.md](./apps/idemAI-api/README.md)** - idem-api documentation

## 🐛 Troubleshooting

### Missing Dependencies

```bash
rm -rf node_modules package-lock.json
npm install
```

### Build Errors

```bash
npm run clean
npm run build:all
```

### Complete Reset

```bash
./scripts/clean.sh
./scripts/setup.sh
```

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. Fork the project
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'feat: Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 Conventions

- **Commits**: Follow [Conventional Commits](https://www.conventionalcommits.org/)
  - `feat:` - New features
  - `fix:` - Bug fixes
  - `docs:` - Documentation changes
  - `chore:` - Maintenance tasks
- **Branches**: `feature/*`, `fix/*`, `chore/*`, `docs/*`
- **Code Style**: ESLint + Prettier (pre-configured)

## 📄 License

This project is licensed under the **Apache License 2.0 with Commons Clause** - see the [LICENSE](LICENSE) file for details.

### License Summary

**✅ You CAN:**

- Use Idem for internal purposes in your organization
- Install Idem on your own servers
- Create projects for your clients using Idem
- Modify and distribute Idem for non-commercial purposes
- Study and learn from the source code

**❌ You CANNOT:**

- Sell Idem as a product or service
- Offer Idem as a hosted SaaS service
- Provide paid consulting/support services based on Idem
- Use the "Idem" brand to sell services without permission
- Commercialize Idem or derivative works

For commercial licensing inquiries, please contact the maintainers.

## 👥 Team

- **arolleaguekeng** - API & Backend Development
- Idem Team

## 🙏 Acknowledgements

- [npm](https://www.npmjs.com) - Package management and workspaces
- [Angular](https://angular.dev) - Frontend framework
- [Svelte](https://svelte.dev) - Reactive framework
- [Mermaid.js](https://mermaid.js.org) - Diagram generation
- [Firebase](https://firebase.google.com) - Backend services
- All contributors and supporters

## 🔗 Useful Links

- [npm Workspaces Documentation](https://docs.npmjs.com/cli/v8/using-npm/workspaces)
- [Angular Documentation](https://angular.dev)
- [Svelte Documentation](https://svelte.dev)
- [Mermaid Documentation](https://mermaid.js.org)
- [React Documentation](https://react.dev)
- [Next.js Documentation](https://nextjs.org)

---

<div align="center">
  <p>Built with ❤️ by the Idem team</p>
  <p><strong>Making software development accessible to everyone through AI</strong></p>
</div>
