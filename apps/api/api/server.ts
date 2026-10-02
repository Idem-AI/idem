// The application itself. Do not start this file directly: `index.ts` loads the
// secrets first and only then imports it, because many modules below read a
// secret when they are imported. `loadSecrets()` is idempotent; the call in
// bootstrap() keeps the validation (and its error) on this path too.
import { loadSecrets } from './config/secrets';

import express, { Express, NextFunction, Request, Response } from 'express';
import logger, { captureConsole, installProcessHandlers, logCritical } from './config/logger';
import { metricsMiddleware } from './middleware/metrics.middleware';
import { languageMiddleware } from './middleware/language.middleware';
import { requestTraceMiddleware } from './middleware/request-trace.middleware';
import { revisionContextMiddleware } from './utils/revision-context.util';
import { describeGeminiBackend, isGeminiConfigured } from './config/google-genai.client';
import { aiUsageContextMiddleware } from './utils/ai-usage-context.util';
import metricsRouter from './routes/metrics.routes';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { applySecurity, auditLogger, redactServerErrors } from './middleware/security.middleware';
import { buildCorsOptions } from './config/cors.config';
import { rateLimitByIP, burstProtection } from './middleware/rate-limit.middleware';
import mongoDBConnection from './config/mongodb.config';
import { storageService } from './services/storage.service';
import { User } from './schemas/user.schema';
import { Project } from './schemas/project.schema';
import { ProjectRevision } from './schemas/revision.schema';
import { CoherenceAlert } from './schemas/coherence.schema';
import { AiUsageEvent } from './schemas/aiUsage.schema';
import {
  BillingInvoice,
  BillingProduct,
  BillingPurchase,
  BillingSubscription,
  CreditLedgerEntry,
} from './schemas/billing.schema';
import {
  CreditBalance,
  PaymentCallbackRaw,
  PaymentEvent,
  PaymentTransaction,
} from './schemas/payment.schema';
import { BillingSettings } from './schemas/billingSettings.schema';
import { BillingSyncJob } from './schemas/billingSync.schema';
import { PricingChange, PricingOverride } from './schemas/pricingOverride.schema';
import { pricingService } from './services/billing/pricing.service';
import { BetaTester } from './schemas/betaTester.schema';
import { EmailLog } from './schemas/emailLog.schema';
import { billingService } from './services/billing.service';
import { billingSettingsService } from './services/billing/billing-settings.service';
import { startBillingScheduler } from './services/billing/billing-scheduler';
import { billingRoutes } from './routes/billing.routes';
import { authRoutes } from './routes/auth.routes';
import { promptRoutes } from './routes/prompt.routes';
import swaggerJsdoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import swaggerOptions from './config/swagger.config';

/**
 * Authentification : un serveur Supabase auto-hébergé émet les jetons d'accès,
 * l'API les échange contre ses propres cookies de session. Une configuration
 * incomplète se voit au démarrage, pas à la première connexion.
 */
function checkAuthConfig(): void {
  const missing = ['SUPABASE_AUTH_URL', 'SUPABASE_JWT_SECRET'].filter((name) => !process.env[name]);
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) missing.push('SESSION_SECRET');
  if (missing.length) {
    console.error(`Authentication NOT CONFIGURED — missing: ${missing.join(', ')}. Sign-in will fail.`);
  } else {
    console.log(`Authentication server: ${process.env.SUPABASE_AUTH_URL}`);
  }
}


import { projectRoutes } from './routes/project.routes';
import { contextRoutes } from './routes/context.routes';
import { coherenceRoutes } from './routes/coherence.routes';
import { brandingRoutes } from './routes/branding.routes';
import { businessCardRoutes } from './routes/businessCard.routes';
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
import fontRoutes from './routes/font.routes';
import { PdfService } from './services/pdf.service';
import RedisConnection from './config/redis.config';
import policyRoutes from './routes/policy.routes';

import contactRoutes from './routes/contactRoutes';
import logoImportRoutes from './routes/logo-import.routes';
import ideployRoutes from './routes/ideploy.routes';
import appgenRoutes from './routes/appgen.routes';
import ogRoutes from './routes/og.routes';
import { communicationRoutes } from './routes/communication.routes';
import { financeRoutes } from './routes/finance.routes';
import { simulationRoutes } from './routes/simulation.routes';

// Tout ce qui s'écrit désormais — y compris les `console.*` restants et les
// crashes — part en JSON corrélé vers les fichiers collectés par Grafana.
captureConsole();
installProcessHandlers();

const app: Express = express();
const port = process.env.PORT || 3001;

// Ouvre le contexte de traçage (requestId) en tout premier: tout ce qui suit
// dans la chaîne (sécurité, morgan, routes, services IA) hérite de la
// corrélation automatiquement via le logger (voir config/logger.ts).
app.use(requestTraceMiddleware);

// Hardening (helmet, hpp, trust proxy, hide X-Powered-By).
applySecurity(app);

// Prometheus metrics middleware (must be before routes)
app.use(metricsMiddleware);

// Journal HTTP : assuré par requestTraceMiddleware (une ligne JSON de début et
// de fin, corrélée). L'ancienne ligne morgan en texte brut faisait doublon.
app.use(cookieParser());

// Strict CORS (env-driven, no localhost in prod).
// MUST run before the body parsers: if express.json rejects an oversized payload
// (413), it forwards an error via next(err), which SKIPS any cors() registered
// afterwards — the browser then sees a misleading "blocked by CORS" instead of the
// real 413. Registering CORS first guarantees the error response carries the
// Access-Control-Allow-Origin header.
app.use(cors(buildCorsOptions()));

// Body size limits prevent trivial DoS via huge payloads.
//
// `verify` conserve le corps EXACT tel qu'il est arrivé. C'est indispensable
// aux callbacks pawaPay : leur signature couvre un condensat du corps octet
// pour octet, et re-sérialiser l'objet JSON analysé (ordre des clés, espaces)
// produirait un condensat différent, donc un rejet de signatures pourtant
// valides.
app.use(
  express.json({
    limit: process.env.JSON_BODY_LIMIT || '10mb',
    verify: (req, _res, buf) => {
      if (req.url?.startsWith('/billing/webhooks/')) {
        (req as Request & { rawBody?: Buffer }).rawBody = Buffer.from(buf);
      }
    },
  })
);
app.use(express.urlencoded({ extended: true, limit: process.env.URLENCODED_BODY_LIMIT || '10mb' }));

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

// Pas de détail d'erreur interne dans les réponses 5xx de production.
app.use(redactServerErrors);

// Resolve the user's UI language (query > body > Accept-Language) and expose it to
// all downstream services so AI generation replies in the right language.
app.use(languageMiddleware);

// Seed the revision context (author user vs AI, source route) so the versioning
// hook can attribute every project write — the "git blame" of project data.
app.use(revisionContextMiddleware);

// Seed the AI usage context (feature + operation derived from the route) so
// every model call can be attributed to a user, a project and a project
// element without threading those values through every generation service.
app.use(aiUsageContextMiddleware);

app.use('/projects', projectRoutes);
app.use('/project', contextRoutes);
app.use('/project', coherenceRoutes);
app.use('/project', brandingRoutes);
app.use('/project', businessCardRoutes);
app.use('/project', diagramRoutes);
app.use('/project', businessPlanRoutes);
app.use('/project', pitchDeckRoutes);
app.use('/project', legalDocsRoutes);
app.use('/project', advisorRoutes);
app.use('/project', onboardingRoutes);
app.use('/project', deploymentRoutes);
app.use('/project', developmentRoutes);
app.use('/project', simulationRoutes);
app.use('/auth', authRoutes);
app.use('/auth', userRoutes);
app.use('/prompt', promptRoutes);
app.use('/quota', quotaRoutes);
// Facturation : catalogue, droits, paiement Mobile Money, callbacks pawaPay.
app.use('/billing', billingRoutes);
app.use('/archetypes', archetypeRoutes);
app.use('/github', githubRoutes);
app.use('/cache', cacheRoutes);
app.use('/fonts', fontRoutes);
app.use('/project', policyRoutes);



// Contact routes
app.use('/api/contact', contactRoutes);

// Logo import routes
app.use('/api/logo', logoImportRoutes);

// iDeploy routes
app.use('/api/ideploy', ideployRoutes);

// AppGen routes
app.use('/appgen', appgenRoutes);

// Images de partage (Open Graph), publiques : voir public/og/README.md
app.use('/og', ogRoutes);

// L'API n'a rien à indexer, sauf les images de partage : les robots des
// réseaux sociaux respectent robots.txt avant de les télécharger.
app.get('/robots.txt', (_req: Request, res: Response) => {
  res.type('text/plain').send('User-agent: *\nAllow: /og/\nDisallow: /\n');
});

// Prometheus metrics endpoint (no auth required for scraping)
app.use('/metrics', metricsRouter);
// Communication routes (strategy / calendar / flyers on demand)
app.use('/project', communicationRoutes);

// Finance module (Prévisions financières — module dédié)
app.use('/project', financeRoutes);

// Swagger setup
// La documentation cartographie toute la surface d'attaque : hors production
// seulement, sauf activation explicite.
if (process.env.NODE_ENV !== 'production' || process.env.ENABLE_API_DOCS === 'true') {
  const swaggerSpec = swaggerJsdoc(swaggerOptions);
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

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
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Gestionnaire d'erreurs : Express ne le reconnaît qu'avec QUATRE paramètres.
// Il ne reflète plus l'origine de la requête (le middleware CORS s'en charge
// pour les seules origines autorisées) et ne renvoie jamais le message interne.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error & { status?: number; type?: string }, req: Request, res: Response, _next: NextFunction) => {
  if (err?.message === 'Not allowed by CORS') {
    res.status(403).json({ error: 'Origin not allowed' });
    return;
  }
  if (err?.type === 'entity.too.large') {
    res.status(413).json({ error: 'Payload too large' });
    return;
  }
  if (err?.type === 'entity.parse.failed') {
    res.status(400).json({ error: 'Invalid JSON body' });
    return;
  }
  logger.error('http.unhandled_error', {
    event: 'http.unhandled_error',
    method: req.method,
    path: req.originalUrl?.split('?')[0],
    error: err,
  });
  if (res.headersSent) return;
  res.status(500).json({ error: 'Internal Server Error' });
});


async function bootstrap() {
  await loadSecrets();
  checkAuthConfig();

  // Backend Gemini (AI Studio) : tracé au démarrage plutôt qu'à la
  // première génération, pour qu'une configuration incomplète se voie tout de
  // suite et non au milieu d'un business plan.
  if (isGeminiConfigured()) {
    console.log(`Gemini backend: ${describeGeminiBackend()}`);
  } else {
    console.error(
      `Gemini backend NON CONFIGURÉ — ${describeGeminiBackend()}. ` +
        'Toute génération IA échouera. Vérifiez GEMINI_API_KEY.'
    );
  }

  return startServer();
}

function startServer() {
  return app.listen(port, async () => {
    logger.info(`Server running on port ${port}`, {
      event: 'process.start',
      port: Number(port),
      node: process.version,
      logLevel: logger.level,
    });

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
        AiUsageEvent.init(), // Journal de consommation IA (+ TTL de rétention)
        // Facturation : index partiels uniques (un abonnement actif par
        // utilisateur ET par moteur, un Project Pass par projet, une facture
        // par période) qui garantissent l'absence de double facturation au
        // niveau de la base.
        BillingProduct.init(),
        BillingSubscription.init(),
        BillingPurchase.init(),
        // File des synchronisations vers iDeploy : la tâche de fond n'y
        // cherche que ce qui est dû, d'où l'index (statut, prochaine tentative).
        BillingSyncJob.init(),
        // Surcharges de prix (une par prix) et leur historique.
        PricingOverride.init(),
        PricingChange.init(),
        BillingInvoice.init(),
        CreditLedgerEntry.init(),
        // Encaissement : `depositId` et `reference` uniques (idempotence), file
        // de relecture, recherche support, et le compteur de crédits atomique.
        PaymentTransaction.init(),
        PaymentEvent.init(),
        PaymentCallbackRaw.init(),
        CreditBalance.init(),
        BillingSettings.init(),
        // Bêta premium : l'unicité de l'adresse empêche d'inviter deux fois la
        // même personne depuis deux imports successifs.
        BetaTester.init(),
        EmailLog.init(),
      ]);

      // Catalogue aligné sur la page de tarification publique. N'écrase jamais
      // un produit existant (un prix ajusté en production doit survivre au
      // redémarrage).
      await billingService.seedProducts();

      // Les prix effectifs — fichier de tarification surchargé par le panel —
      // sont recopiés sur les produits : tout le code qui lit `priceXaf` voit
      // ainsi le prix réellement appliqué, dès le démarrage.
      await pricingService.materialize();

      // Réglages commerciaux (bêta, mode d'application du barème, grâce).
      await billingSettingsService.ensureExists();
      console.log('MongoDB indexes created successfully');

      // Réconciliation des paiements : le filet qui rattrape les callbacks
      // perdus et les livraisons échouées. Démarré après la base, sans quoi
      // le premier passage échouerait sur une connexion absente.
      startBillingScheduler();
    } catch (error) {
      logCritical('startup.mongodb_failed', { error });
      // Laisse aux transports fichiers le temps d'écrire la ligne critique.
      setTimeout(() => process.exit(1), 500);
      return;
    }

    // Initialize MinIO storage
    try {
      await storageService.initialize();
      console.log('MinIO storage initialized successfully');
    } catch (error) {
      logCritical('startup.storage_failed', { error });
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
  logCritical('startup.failed', { error: err });
  setTimeout(() => process.exit(1), 500);
  return undefined;
});

async function shutdown(signal: string) {
  logger.info('process.shutdown', { event: 'process.shutdown', signal, uptimeS: Math.round(process.uptime()) });
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


export default app;
