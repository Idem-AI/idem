// IMPORTANT: secrets must be loaded BEFORE any other module that reads
// process.env at import time. We therefore load them inside an async
// bootstrap() function and gate the rest of the wiring behind it.
import { loadSecrets } from './config/secrets';

import express, { Express, Request, Response } from 'express';
import morgan from 'morgan';
import { stream as loggerStream } from './config/logger';
import { metricsMiddleware } from './middleware/metrics.middleware';
import { languageMiddleware } from './middleware/language.middleware';
import { revisionContextMiddleware } from './utils/revision-context.util';
import metricsRouter from './routes/metrics.routes';
import admin from 'firebase-admin';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { applySecurity, auditLogger } from './middleware/security.middleware';
import { buildCorsOptions } from './config/cors.config';
import { rateLimitByIP, burstProtection } from './middleware/rate-limit.middleware';
import mongoDBConnection from './config/mongodb.config';
import { storageService } from './services/storage.service';
import { User } from './schemas/user.schema';
import { Project } from './schemas/project.schema';
import { ProjectRevision } from './schemas/revision.schema';
import { CoherenceAlert } from './schemas/coherence.schema';
import { authRoutes } from './routes/auth.routes';
import { promptRoutes } from './routes/prompt.routes';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import swaggerOptions from './config/swagger.config';

function initFirebase(): void {
  // Firebase Auth initialization (kept for authentication only - backward compatibility)
  const serviceAccountFromEnv = {
    type: 'service_account',
    project_id: process.env.FIREBASE_PROJECT_ID,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
    // Newlines already normalised by loadSecrets(), but keep this safe for
    // values pulled from a raw shell env.
    private_key: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    client_id: process.env.FIREBASE_CLIENT_ID,
    auth_uri: 'https://accounts.google.com/o/oauth2/auth',
    token_uri: 'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_CERT_URL,
  };

  if (serviceAccountFromEnv.project_id && serviceAccountFromEnv.private_key) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountFromEnv as admin.ServiceAccount),
      projectId: process.env.FIREBASE_PROJECT_ID,
    });
    console.log('Firebase Admin SDK initialized successfully (Auth only).');
  } else {
    console.error(
      'Firebase Admin SDK initialization failed: Missing credentials in environment variables.'
    );
  }
}

import { projectRoutes } from './routes/project.routes';
import { contextRoutes } from './routes/context.routes';
import { coherenceRoutes } from './routes/coherence.routes';
import { brandingRoutes } from './routes/branding.routes';
import { diagramRoutes } from './routes/diagram.routes';
import { businessPlanRoutes } from './routes/businessPlan.routes';
import { pitchDeckRoutes } from './routes/pitchDeck.routes';
import { legalDocsRoutes } from './routes/legalDocs.routes';
import { advisorRoutes } from './routes/advisor.routes';
import { onboardingRoutes } from './routes/onboarding.routes';
import { deploymentRoutes } from './routes/deployment.routes';
import { developmentRoutes } from './routes/development.routes';
import { userRoutes } from './routes/user.routes';
import githubRoutes from './routes/github.routes';
import archetypeRoutes from './routes/archetype.routes';
import quotaRoutes from './routes/quota.routes';
import cacheRoutes from './routes/cache.routes';
import { PdfService } from './services/pdf.service';
import RedisConnection from './config/redis.config';
import policyRoutes from './routes/policy.routes';

import contactRoutes from './routes/contactRoutes';
import logoImportRoutes from './routes/logo-import.routes';
import ideployRoutes from './routes/ideploy.routes';
import appgenRoutes from './routes/appgen.routes';
import { communicationRoutes } from './routes/communication.routes';
import { financeRoutes } from './routes/finance.routes';

const app: Express = express();
const port = process.env.PORT || 3001;

// Hardening (helmet, hpp, trust proxy, hide X-Powered-By).
applySecurity(app);

// Prometheus metrics middleware (must be before routes)
app.use(metricsMiddleware);

// HTTP request logging middleware
app.use(morgan('combined', { stream: loggerStream }));
app.use(cookieParser());

// Body size limits prevent trivial DoS via huge payloads.
app.use(express.json({ limit: process.env.JSON_BODY_LIMIT || '1mb' }));
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '1mb' }));

// Strict CORS (env-driven, no localhost in prod).
app.use(cors(buildCorsOptions()));

// Burst protection + global IP rate limit (in addition to per-route limits).
app.use(burstProtection({ maxBurst: 30, burstWindowMs: 1000 }));
app.use(
  rateLimitByIP({
    windowMs: 15 * 60 * 1000,
    maxRequests: Number(process.env.GLOBAL_RATE_LIMIT_MAX || 600),
    keyPrefix: 'ratelimit:global',
  })
);

// Audit log for sensitive routes.
app.use(auditLogger);

// Resolve the user's UI language (query > body > Accept-Language) and expose it to
// all downstream services so AI generation replies in the right language.
app.use(languageMiddleware);

// Seed the revision context (author user vs AI, source route) so the versioning
// hook can attribute every project write — the "git blame" of project data.
app.use(revisionContextMiddleware);

app.use('/projects', projectRoutes);
app.use('/project', contextRoutes);
app.use('/project', coherenceRoutes);
app.use('/project', brandingRoutes);
app.use('/project', diagramRoutes);
app.use('/project', businessPlanRoutes);
app.use('/project', pitchDeckRoutes);
app.use('/project', legalDocsRoutes);
app.use('/project', advisorRoutes);
app.use('/project', onboardingRoutes);
app.use('/project', deploymentRoutes);
app.use('/project', developmentRoutes);
app.use('/auth', authRoutes);
app.use('/auth', userRoutes);
app.use('/prompt', promptRoutes);
app.use('/quota', quotaRoutes);
app.use('/archetypes', archetypeRoutes);
app.use('/github', githubRoutes);
app.use('/cache', cacheRoutes);
app.use('/project', policyRoutes);



// Contact routes
app.use('/api/contact', contactRoutes);

// Logo import routes
app.use('/api/logo', logoImportRoutes);

// iDeploy routes
app.use('/api/ideploy', ideployRoutes);

// AppGen routes
app.use('/appgen', appgenRoutes);

// Prometheus metrics endpoint (no auth required for scraping)
app.use('/metrics', metricsRouter);
// Communication routes (strategy / calendar / flyers on demand)
app.use('/project', communicationRoutes);

// Finance module (Prévisions financières — module dédié)
app.use('/project', financeRoutes);

// Swagger setup
const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get('/', (req: Request, res: Response) => {
  res.status(200).json({
    message: 'Welcome to idem API',
    status: 'healthy',
    timestamp: new Date().toISOString(),
  });
});

// Health check endpoint for monitoring probes
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({
    status: 'healthy',
    service: 'idem-api',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memoryUsage: process.memoryUsage(),
    version: process.env.npm_package_version || '1.0.0',
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

app.use((err: Error, req: Request, res: Response /*, next: NextFunction */) => {
  console.error('Global error handler:', err);
  
  // S'assurer que les en-têtes CORS sont présents même en cas d'erreur
  const origin = req.headers.origin;
  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
  }
  
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message || 'Something broke!'
  });
});


async function bootstrap() {
  await loadSecrets();
  initFirebase();
  return startServer();
}

function startServer() {
  return app.listen(port, async () => {
    console.log(`Server running on port ${port}`);

    // Initialize MongoDB connection
    try {
      await mongoDBConnection.connect();
      console.log('MongoDB connection established successfully');

      // Initialize Mongoose models and create indexes
      console.log('Initializing MongoDB indexes...');
      await Promise.all([
        User.init(), // Creates all indexes defined in UserSchema
        Project.init(), // Creates all indexes defined in ProjectSchema
        ProjectRevision.init(), // Chronicle: unique (projectId, section, version) + log indexes
        CoherenceAlert.init(), // Coherence Guard: alertes de synchronisation inter-artefacts
      ]);
      console.log('MongoDB indexes created successfully');
    } catch (error) {
      console.error('Failed to connect to MongoDB:', error);
      process.exit(1);
    }

    // Initialize MinIO storage
    try {
      await storageService.initialize();
      console.log('MinIO storage initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MinIO storage:', error);
    }

    // Initialiser le PdfService au démarrage pour optimiser les performances
    try {
      await PdfService.initialize();
      console.log('PdfService initialized successfully');
    } catch (error) {
      console.error('Failed to initialize PdfService:', error);
    }

    // Tester la connexion Redis au démarrage
    try {
      const redisConnected = await RedisConnection.testConnection();
      if (redisConnected) {
        console.log('Redis connection established successfully');
      } else {
        console.warn('Redis connection test failed - cache will be disabled');
      }
    } catch (error) {
      console.error('Redis connection error:', error);
    }
  });
}

const serverPromise = bootstrap().catch((err) => {
  console.error('Fatal bootstrap error:', err);
  process.exit(1);
});

async function shutdown(signal: string) {
  console.log(`${signal} received, shutting down gracefully...`);
  const server = await serverPromise;
  await PdfService.closeBrowser();
  await RedisConnection.disconnect();
  await mongoDBConnection.disconnect();
  server?.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
}

// Gestion propre de l'arrêt de l'application
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export { admin };

export default app;
