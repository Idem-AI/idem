# IDEM - AI-Powered Software Development Lifecycle Generator

<div align="center">
  <img src="public/logo_white.png" alt="IDEM Logo" width="200" height="auto">
  <p><strong>Transform ideas into complete software projects with AI</strong></p>
</div>

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](CODE_OF_CONDUCT.md)

## Overview

IDEM is a revolutionary open-source platform that leverages artificial intelligence to generate all elements of the software development lifecycle. From initial business planning to deployment, IDEM streamlines the creation process for developers, entrepreneurs, and product managers while making the entire software development process accessible to users of all technical backgrounds.

**Frontend Demo:** [https://idem-ai.com](https://idem-ai.com)

## Features

IDEM helps you generate:

- **Branding**: AI designs logos and complete brand style guides based on your requirements
- **UML Analysis**: AI develops detailed UML diagrams and system architecture documentation
- **Landing Page Creation**: AI designs responsive landing pages for your application
- **Project Generation**: AI builds full software projects based on your specifications
- **Documentation**: AI generates comprehensive technical documentation for your software
- **Deployment Management**: AI streamlines the deployment process across different 

## Architecture

This repository contains the backend for IDEM, built with Express.js. The system uses:

- **Firebase/Firestore**: For data storage and authentication
- **AI Services**: Integration with Google's Gemini and OpenAI for content generation
- **Repository Pattern**: Flexible database access layer with SGBD abstraction
- **Winston**: Comprehensive logging system

## Key Components

### Repository Structure

- **Data Models**: Define the shape of data (`api/models/*.model.ts`)
- **Services**: Business logic and AI integration (`api/services/`)
- **Controllers**: HTTP request handling (`api/controllers/`)
- **Routes**: API endpoints (`api/routes/`)

### CRUD Operations

The system implements a unified CRUD structure for:
- Projects
- Business Plans
- Branding (Logos, Color Schemes)
- UML Diagrams
- Risk Analysis
- Feasibility Studies

### AI Generation

The backend integrates with AI models to generate:
- Business plans with multi-turn generation
- Logos and brand identities
- System architecture diagrams
- Project code and documentation

## Installation

```bash
# Clone the repository
git clone https://github.com/arolleaguekeng/idem-api.git
cd idem-api

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your API keys and configuration

# Run the development server
npm run dev
```

## Environment Variables

Create a `.env` file with the following variables:

```
PORT=3000
GOOGLE_API_KEY=your_google_api_key
OPENAI_API_KEY=your_openai_api_key
FIREBASE_PROJECT_ID=your_firebase_project_id
# Add other Firebase-related environment variables
```

## API Documentation

### Projects

```
GET /projects - Get all projects for the authenticated user
GET /projects/:projectId - Get a specific project
POST /projects - Create a new project
PUT /projects/:projectId - Update a project
DELETE /projects/:projectId - Delete a project
GET /projects/:projectId/agentic - Generate a ZIP with project structure
```

### Business Plans

```
POST /planning/business-plans - Generate a business plan
GET /planning/business-plans/:id - Get a business plan by ID
PUT /planning/business-plans/:id - Update a business plan
DELETE /planning/business-plans/:id - Delete a business plan
```

### Branding

```
POST /branding/logos - Generate a logo
GET /branding/logos/:id - Get a logo by ID
# Additional branding endpoints...
```

### Diagrams

```
POST /diagrams - Generate UML diagrams
GET /diagrams/:id - Get a diagram by ID
# Additional diagram endpoints...
```

## Contributing

We welcome contributions to IDEM! Please read our [Contributing Guidelines](CONTRIBUTING.md) and [Code of Conduct](CODE_OF_CONDUCT.md) before submitting PRs.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

- Project Creator: [arolleaguekeng](https://github.com/arolleaguekeng)
- Website: [https://idem-ai.com](https://idem-ai.com)
