import express, { Express, Request, Response } from 'express';
import dotenv from 'dotenv';
import morgan from 'morgan';
import helmet from 'helmet';
import { corsMiddleware } from './middleware/cors.js';
import { errorHandler } from './middleware/errorHandler.js';
import { metricsMiddleware, register } from './middleware/metrics.js';
import chatRouter from './routes/chat.js';
import deployRouter from './routes/deploy.js';
import enhancedPromptRouter from './routes/enhancedPrompt.js';
import modelRouter from './routes/model.js';
import handoffRouter from './routes/handoff.js';
import qualityRouter from './routes/quality.js';
import assetsRouter from './routes/assets.js';
import mcpRouter from './mcp/server.js';
import { loadSkills } from './skills/registry.js';

dotenv.config();

// Read the catalog off disk once at boot rather than on the first generation,
// so a malformed skill fails loudly at startup instead of mid-request.
loadSkills();

const app: Express = express();
const PORT = process.env.PORT || 3000;

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

app.use(morgan('combined'));

// Prometheus metrics middleware
app.use(metricsMiddleware);

app.use(corsMiddleware);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.get('/', (req: Request, res: Response) => {
  res.json({
    name: '@we-dev/express',
    version: '1.0.0',
    description: 'Express.js replica of we-dev-next application',
    status: 'running',
    endpoints: {
      chat: '/api/chat',
      deploy: '/api/deploy',
      enhancedPrompt: '/api/enhancedPrompt',
      model: '/api/model',
      quality: '/api/quality/lint',
      mcp: '/mcp',
    },
  });
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

app.use('/api/chat', chatRouter);
app.use('/api/deploy', deployRouter);
app.use('/api/enhancedPrompt', enhancedPromptRouter);
app.use('/api/model', modelRouter);
app.use('/api/handoff', handoffRouter);
app.use('/api/quality', qualityRouter);

// Local-development helper: reads an http:// bucket asset back as a data URI so
// the HTTPS WebContainer preview can display it. See routes/assets.ts.
app.use('/api/assets', assetsRouter);

// MCP endpoint: the skill catalog, the token forge and the linter, reusable by
// any MCP client. appgen's own generation path imports them directly instead.
app.use('/mcp', mcpRouter);

// Prometheus metrics endpoint
app.get('/metrics', async (req: Request, res: Response) => {
  try {
    res.set('Content-Type', register.contentType);
    const metrics = await register.metrics();
    res.end(metrics);
  } catch (error) {
    res.status(500).end('Error collecting metrics');
  }
});

app.use(errorHandler);

app.use((req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.originalUrl,
  });
});

app.listen(PORT, () => {
  console.log('\n');
  console.log('='.repeat(80));
  console.log('🚀 WE-DEV EXPRESS SERVER STARTED');
  console.log('='.repeat(80));
  console.log(`📡 Server running on: http://localhost:${PORT}`);
  console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`📝 API Documentation: http://localhost:${PORT}/`);
  console.log('='.repeat(80));
  console.log('\n📋 Available Endpoints:');
  console.log(`   POST   /api/chat              - Chat with AI (builder/chat mode)`);
  console.log(`   POST   /api/deploy            - Deploy to Netlify`);
  console.log(`   POST   /api/enhancedPrompt    - Enhance prompts with AI`);
  console.log(`   GET    /api/model             - Get available models`);
  console.log(`   GET    /api/model/config      - Get model configuration`);
  console.log(`   GET    /api/model/default     - Get default model`);
  console.log(`   POST   /api/handoff           - Store AppGen context for handoff`);
  console.log(`   GET    /api/handoff/:id       - Retrieve AppGen handoff by ID`);
  console.log(`   GET    /health                - Health check`);
  console.log('='.repeat(80));
  console.log('\n');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  process.exit(1);
});

export default app;
