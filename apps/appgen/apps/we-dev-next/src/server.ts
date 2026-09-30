// En premier, avant tout autre import : les modules importés ci-dessous lisent
// `process.env` au niveau module (catalogue de modèles, skills, screenshot),
// et la phase d'import ESM s'exécute entièrement avant la première
// instruction du corps. Un `dotenv.config()` placé plus bas arriverait donc
// trop tard et laisserait ces lectures à `undefined`.
import 'dotenv/config';
import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import logger, { captureConsole, installProcessHandlers } from './config/logger.js';
import { requestTraceMiddleware } from './middleware/requestTrace.js';
import { corsMiddleware } from './middleware/cors.js';
import { requireIdemUser } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { metricsMiddleware, register } from './middleware/metrics.js';
import chatRouter from './routes/chat.js';
import deployRouter from './routes/deploy.js';
import enhancedPromptRouter from './routes/enhancedPrompt.js';
import modelRouter from './routes/model.js';
import handoffRouter from './routes/handoff.js';
import qualityRouter from './routes/quality.js';
import designRouter from './routes/design.js';
import assetsRouter from './routes/assets.js';
import mcpRouter from './mcp/server.js';
import { loadSkills } from './skills/registry.js';


// Tout ce qui s'écrit désormais — y compris les `console.*` restants et les
// crashes — part en JSON corrélé vers les fichiers collectés par Grafana.
captureConsole();
installProcessHandlers();

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

// Contexte de traçage + journal HTTP (une ligne JSON de début et de fin par
// requête, corrélée). Remplace la ligne morgan en texte brut.
app.use(requestTraceMiddleware);

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
      design: '/api/design/forge',
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

// Routes qui consomment des ressources payantes (modèles, compte Netlify) :
// réservées aux utilisateurs IDEM authentifiés.
app.use('/api/chat', requireIdemUser, chatRouter);
app.use('/api/deploy', requireIdemUser, deployRouter);
app.use('/api/enhancedPrompt', requireIdemUser, enhancedPromptRouter);
app.use('/api/model', modelRouter);
// Stockage en mémoire : réservé aux utilisateurs connectés (sinon n'importe qui
// peut remplir la mémoire du serveur).
app.use('/api/handoff', requireIdemUser, handoffRouter);
app.use('/api/quality', qualityRouter);
app.use('/api/design', designRouter);

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
  logger.info(`AppGen server running on http://localhost:${PORT}`, {
    event: 'process.start',
    port: Number(PORT),
    node: process.version,
    logLevel: logger.level,
    endpoints: ['/api/chat', '/api/deploy', '/api/enhancedPrompt', '/api/model', '/api/handoff', '/api/quality', '/api/design', '/mcp', '/health'],
  });
});

export default app;
