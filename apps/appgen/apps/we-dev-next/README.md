# @we-dev/express

Express.js 5.2.1 replica of the we-dev-next application with complete feature parity.

## 🚀 Features

- ✅ **Complete API Routes**: All routes from Next.js replicated
  - `/api/chat` - AI chat with builder and chat modes
  - `/api/deploy` - Netlify deployment
  - `/api/enhancedPrompt` - AI prompt enhancement
  - `/api/model` - Model configuration management

- ✅ **AI Integration**: Full support for multiple AI providers
  - OpenAI (GPT-4, GPT-3.5)
  - Google Gemini
  - DeepSeek
  - Anthropic Claude

- ✅ **Project Generation**: Complete project prompt service
  - Landing page generation (separate, integrated, only)
  - Full application generation
  - Brand identity integration
  - Technology stack configuration
  - Use case diagram implementation

- ✅ **Advanced Features**:
  - Screenshot capture integration
  - File processing and diff generation
  - Token management
  - Streaming responses
  - Tool calling support
  - Docker configuration generation

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Configure your environment variables
# Edit .env with your API keys
```

## 🔧 Configuration

Create a `.env` file with the following variables:

```env
# Server Configuration
PORT=3002
NODE_ENV=development

# AI API Configuration
THIRD_API_URL=https://api.openai.com/v1
THIRD_API_KEY=your_api_key_here

# AI Models Configuration (JSON format)
AI_MODELS_CONFIG=[{"modelName":"GPT-4","modelKey":"gpt-4","useImage":true,"provider":"openai","functionCall":true}]
AI_DEFAULT_MODEL=gpt-4

# Screenshot Service
SCREENSHOTONE_API_KEY=your_screenshotone_api_key

# Netlify Deployment
NETLIFY_TOKEN=your_netlify_token
NETLIFY_DEPLOY_URL=https://api.netlify.com/api/v1/sites

# CORS Configuration
CORS_ORIGIN=*

# AI Generation Token Limits
AI_MAX_OUTPUT_TOKENS=8192      # Maximum tokens in AI response
AI_MAX_INPUT_TOKENS=128000     # Maximum tokens in input context
AI_STANDARD_TOKEN_LIMIT=128000 # Threshold for token-limited mode
```

### Token Limits Configuration

Control AI generation token limits via environment variables. See [TOKEN_LIMITS.md](./TOKEN_LIMITS.md) for detailed documentation.

**Quick Configuration:**

- `AI_MAX_OUTPUT_TOKENS` - Maximum tokens the AI can generate (default: 8192)
- `AI_MAX_INPUT_TOKENS` - Maximum tokens in input context (default: 128000)
- `AI_STANDARD_TOKEN_LIMIT` - Threshold for smart token management (default: 128000)

**Example configurations:**

```env
# Standard (recommended)
AI_MAX_OUTPUT_TOKENS=8192
AI_MAX_INPUT_TOKENS=128000

# High performance
AI_MAX_OUTPUT_TOKENS=16384
AI_MAX_INPUT_TOKENS=200000

# Cost-effective
AI_MAX_OUTPUT_TOKENS=4096
AI_MAX_INPUT_TOKENS=32000
```

## 🏃 Running the Application

### Development Mode

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

## 📡 API Endpoints

### POST /api/chat

Chat with AI in builder or chat mode.

**Request Body:**

```json
{
  "messages": [
    {
      "id": "uuid",
      "role": "user",
      "content": "Create a todo app"
    }
  ],
  "model": "gpt-4",
  "mode": "builder",
  "projectData": {
    "name": "My Project",
    "description": "Project description",
    "type": "web",
    "analysisResultModel": {}
  }
}
```

**Headers:**

- `userId` (optional): User identifier for token tracking

### POST /api/deploy

Deploy a zip file to Netlify.

**Request:**

- Content-Type: `multipart/form-data`
- Field: `file` (zip file)

**Response:**

```json
{
  "success": true,
  "url": "https://your-app.netlify.app",
  "siteInfo": {}
}
```

### POST /api/enhancedPrompt

Enhance a prompt using AI.

**Request Body:**

```json
{
  "text": "Your prompt to enhance"
}
```

**Response:**

```json
{
  "code": 0,
  "text": "Enhanced prompt"
}
```

### GET /api/model

Get available AI models.

**Response:**

```json
[
  {
    "modelName": "GPT-4",
    "modelKey": "gpt-4",
    "useImage": true,
    "provider": "openai",
    "functionCall": true
  }
]
```

### GET /api/model/config

Get model configuration (same as /api/model).

### GET /api/model/default

Get default model.

**Response:**

```json
{
  "modelKey": "gpt-4"
}
```

### GET /health

Health check endpoint.

**Response:**

```json
{
  "status": "healthy",
  "timestamp": "2024-01-28T10:00:00.000Z",
  "uptime": 123.456
}
```

## 🏗️ Project Structure

```
src/
├── config/              # Configuration files
│   ├── dockerfilePrompt.ts
│   ├── modelConfig.ts
│   └── prompts.ts
├── handlers/            # Request handlers
│   ├── builderHandler.ts
│   └── chatHandler.ts
├── middleware/          # Express middleware
│   ├── cors.ts
│   └── errorHandler.ts
├── routes/              # API routes
│   ├── chat.ts
│   ├── deploy.ts
│   ├── enhancedPrompt.ts
│   └── model.ts
├── services/            # Business logic services
│   ├── aiService.ts
│   └── projectPromptService.ts
├── types/               # TypeScript types
│   └── project.ts
├── utils/               # Utility functions
│   ├── diffGenerator.ts
│   ├── fileProcessor.ts
│   ├── fileTypeDetector.ts
│   ├── json2zod.ts
│   ├── logger.ts
│   ├── markdown.ts
│   ├── messageParser.ts
│   ├── screenshotone.ts
│   ├── streamResponse.ts
│   ├── stripIndent.ts
│   ├── switchableStream.ts
│   ├── tokenHandler.ts
│   └── tokens.ts
└── server.ts            # Main server file
```

## 🔄 Differences from Next.js Version

### Architecture

- **Framework**: Express.js 5.2.1 instead of Next.js 14
- **Routing**: Traditional Express routing instead of Next.js App Router
- **Middleware**: Custom middleware instead of Next.js middleware
- **File Upload**: Multer instead of Next.js FormData

### Advantages

- ✅ Simpler deployment (no SSR complexity)
- ✅ More control over middleware
- ✅ Better performance for API-only workloads
- ✅ Easier to integrate with existing Express ecosystems
- ✅ Standard Node.js patterns

### Feature Parity

- ✅ All API endpoints replicated
- ✅ Same AI integration
- ✅ Same project generation logic
- ✅ Same prompt system
- ✅ Same file processing
- ✅ Same streaming responses
- ✅ Same error handling

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:3002/health

# Test chat endpoint
curl -X POST http://localhost:3002/api/chat \
  -H "Content-Type: application/json" \
  -H "userId: test-user" \
  -d '{
    "messages": [{"id":"1","role":"user","content":"Create a todo app"}],
    "model": "gpt-4",
    "mode": "builder"
  }'

# Test model endpoint
curl http://localhost:3002/api/model
```

## 📝 Logging

The application uses a comprehensive logging system with:

- Structured logging with timestamps
- Log levels: INFO, WARN, ERROR, DEBUG, SUCCESS
- Step tracking for complex operations
- Detailed error information

## 🔒 Security

- Helmet.js for security headers
- CORS configuration
- Request size limits (50mb)
- Environment variable protection
- Error sanitization in production

## 🚀 Deployment

### Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3002
CMD ["node", "dist/server.js"]
```

### Build and Run

```bash
npm run build
docker build -t we-dev-express .
docker run -p 3002:3002 --env-file .env we-dev-express
```

## 📄 License

Same as parent project.

## 🤝 Contributing

This is a replica of the Next.js version. Maintain feature parity when making changes.

## 📚 Documentation

- [Token Limits Configuration](./TOKEN_LIMITS.md) - Configure AI generation token limits
- [Next.js Original](../we-dev-next/README.md)
- [API Documentation](./docs/API.md)
- [Architecture](./docs/ARCHITECTURE.md)

## 🆘 Support

For issues or questions, please refer to the main project documentation.
