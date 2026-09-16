import client from 'prom-client';

// Create a Registry
const register = new client.Registry();

// Add default Node.js metrics (event loop lag, heap size, GC, etc.)
client.collectDefaultMetrics({
  register,
  prefix: 'nodejs_',
  labels: { service: 'idem-api' },
});

// ==================== CUSTOM METRICS ====================

// HTTP request counter
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code', 'service'] as const,
  registers: [register],
});

// HTTP request duration histogram
export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code', 'service'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

// HTTP request size
export const httpRequestSize = new client.Histogram({
  name: 'http_request_size_bytes',
  help: 'Size of HTTP requests in bytes',
  labelNames: ['method', 'route', 'service'] as const,
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

// HTTP response size
export const httpResponseSize = new client.Histogram({
  name: 'http_response_size_bytes',
  help: 'Size of HTTP responses in bytes',
  labelNames: ['method', 'route', 'status_code', 'service'] as const,
  buckets: [100, 1000, 10000, 100000, 1000000, 10000000],
  registers: [register],
});

// Active connections gauge
export const activeConnections = new client.Gauge({
  name: 'http_active_connections',
  help: 'Number of active HTTP connections',
  labelNames: ['service'] as const,
  registers: [register],
});

// Error counter by type
export const errorsTotal = new client.Counter({
  name: 'app_errors_total',
  help: 'Total number of application errors',
  labelNames: ['type', 'service'] as const,
  registers: [register],
});

// Database operation duration
export const dbOperationDuration = new client.Histogram({
  name: 'db_operation_duration_seconds',
  help: 'Duration of database operations in seconds',
  labelNames: ['operation', 'collection', 'service'] as const,
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5],
  registers: [register],
});

// ==================== MÉTRIQUES IA ====================
//
// Les données existaient déjà (`AiUsageEvent` en base, `ai-trace.log`), mais pas
// à un endroit où une alerte peut les lire. Quatre séries suffisent à piloter
// les trois axes du produit — qualité, vitesse, coût — et elles sont toutes
// alimentées depuis un point unique : `aiUsageService.record`.

/** Latence d'un appel modèle. `tier` distingue XS/M/S, `status` succès/échec. */
export const aiCallDuration = new client.Histogram({
  name: 'ai_call_duration_seconds',
  help: 'Duration of a model call in seconds',
  labelNames: ['provider', 'model', 'prompt_type', 'status', 'service'] as const,
  // Bornes larges : une classification tient en 1 s, une page HTML complète en
  // dépasse 60. Un histogramme trop serré écraserait justement ce qu'on veut voir.
  buckets: [0.5, 1, 2, 5, 10, 20, 40, 80, 160],
  registers: [register],
});

/**
 * Tokens consommés. `kind` vaut `input`, `output` ou `cached` — c'est ce
 * dernier qui mesure l'efficacité du cache de préfixe, indépendamment de sa
 * tarification.
 */
export const aiTokensTotal = new client.Counter({
  name: 'ai_tokens_total',
  help: 'Tokens consumed by model calls',
  labelNames: ['provider', 'model', 'kind', 'service'] as const,
  registers: [register],
});

/** Coût estimé, ventilé par fonctionnalité — le fil à tirer quand la facture monte. */
export const aiCostUsdTotal = new client.Counter({
  name: 'ai_cost_usd_total',
  help: 'Estimated cost of model calls, in USD',
  labelNames: ['provider', 'model', 'feature', 'service'] as const,
  registers: [register],
});

/**
 * Issue qualité d'un appel : `ok`, `error`, `escalated`, `repaired`, `flagged`,
 * `fallback`. C'est la série qui dit si la baisse d'étage tient — une hausse
 * de `escalated` après un dépinglage désigne exactement les sections où le
 * rendu déterministe ne suffit pas encore.
 */
export const aiOutcomeTotal = new client.Counter({
  name: 'ai_outcome_total',
  help: 'Quality outcome of model calls',
  labelNames: ['outcome', 'prompt_type', 'service'] as const,
  registers: [register],
});

// ==================== MÉTRIQUES DE PAIEMENT ====================
//
// L'encaissement Mobile Money échoue souvent, et pour des raisons qui ne sont
// pas de notre ressort (code non saisi, solde insuffisant, opérateur fermé).
// Ce qui doit se voir tout de suite, c'est un changement de régime : un
// opérateur qui décroche, un tunnel qui cesse de convertir, une livraison qui
// ne suit plus l'encaissement. Ces séries sont alimentées depuis un point
// unique — `paymentEventsService.record` — comme les métriques IA le sont
// depuis `aiUsageService.record`.

/** Paiements lancés, par opérateur, pays et nature de produit. */
export const paymentsInitiatedTotal = new client.Counter({
  name: 'payments_initiated_total',
  help: 'Payments initiated',
  labelNames: ['provider', 'country', 'intent_type', 'service'] as const,
  registers: [register],
});

/** Paiements encaissés. Le rapport avec la série précédente EST le taux de conversion. */
export const paymentsCompletedTotal = new client.Counter({
  name: 'payments_completed_total',
  help: 'Payments completed',
  labelNames: ['provider', 'country', 'intent_type', 'service'] as const,
  registers: [register],
});

/**
 * Paiements échoués, ventilés par code d'échec. C'est la série qui distingue
 * « nos clients n'ont pas de solde » de « l'opérateur est en panne » — deux
 * situations identiques sur une courbe de succès, opposées en conduite.
 */
export const paymentsFailedTotal = new client.Counter({
  name: 'payments_failed_total',
  help: 'Payments that reached a failed state',
  labelNames: ['provider', 'failure_code', 'status', 'service'] as const,
  registers: [register],
});

/** Délai entre le lancement et le statut final : ce que l'abonné attend devant son écran. */
export const paymentTimeToFinal = new client.Histogram({
  name: 'payment_time_to_final_seconds',
  help: 'Seconds between initiation and final status',
  labelNames: ['provider', 'status', 'service'] as const,
  // De la validation immédiate (10 s) à la réconciliation tardive (1 h).
  buckets: [5, 10, 20, 30, 60, 120, 300, 600, 1800, 3600],
  registers: [register],
});

/** Appels à l'API pawaPay : c'est ici que se voit une panne côté prestataire. */
export const pawapayRequestsTotal = new client.Counter({
  name: 'pawapay_api_requests_total',
  help: 'Calls to the pawaPay API',
  labelNames: ['endpoint', 'status', 'service'] as const,
  registers: [register],
});

export const pawapayRequestDuration = new client.Histogram({
  name: 'pawapay_api_duration_seconds',
  help: 'Duration of pawaPay API calls',
  labelNames: ['endpoint', 'service'] as const,
  buckets: [0.1, 0.25, 0.5, 1, 2, 5, 10, 15],
  registers: [register],
});

/**
 * Callbacks reçus, par issue : `accepted`, `signature_invalid`, `ip_rejected`,
 * `unknown_deposit`, `duplicate`. Une signature invalide n'est jamais anodine.
 */
export const paymentCallbacksTotal = new client.Counter({
  name: 'payment_callbacks_total',
  help: 'Inbound pawaPay callbacks by outcome',
  labelNames: ['kind', 'result', 'service'] as const,
  registers: [register],
});

/** Paiements sans statut final depuis trop longtemps — la file d'attente du support. */
export const paymentsStuckGauge = new client.Gauge({
  name: 'payments_pending_stuck',
  help: 'Payments pending beyond the expected settlement delay',
  labelNames: ['service'] as const,
  registers: [register],
});

/**
 * Livraisons échouées après encaissement. Toute valeur non nulle est un client
 * qui a payé sans rien recevoir : c'est l'alerte la plus grave du système.
 */
export const paymentFulfillmentFailuresTotal = new client.Counter({
  name: 'payment_fulfillment_failures_total',
  help: 'Fulfilment failures on completed payments',
  labelNames: ['intent_type', 'service'] as const,
  registers: [register],
});

/** Crédits débités, par moteur et par livrable — le pendant métier du coût IA. */
export const creditsDebitedTotal = new client.Counter({
  name: 'credits_debited_total',
  help: 'Credits debited from user meters',
  labelNames: ['engine', 'action', 'service'] as const,
  registers: [register],
});

/** E-mails transactionnels, par modèle et par issue. */
export const emailsSentTotal = new client.Counter({
  name: 'emails_sent_total',
  help: 'Transactional emails sent',
  labelNames: ['template', 'status', 'service'] as const,
  registers: [register],
});

/**
 * Exécutions des tâches planifiées (réconciliation, renouvellements, bêta).
 * Une tâche qui cesse de tourner est invisible autrement : elle ne produit ni
 * erreur ni trafic.
 */
export const billingJobRunsTotal = new client.Counter({
  name: 'billing_job_runs_total',
  help: 'Scheduled billing job executions',
  labelNames: ['job', 'result', 'service'] as const,
  registers: [register],
});

/**
 * Retard de la propagation des plans vers iDeploy.
 *
 * iDeploy vit dans une autre base : un plan payé y arrive par une file qui
 * réessaie. Une valeur qui ne redescend pas, c'est un client qui paie un plan
 * dont il ne dispose pas — et personne d'autre que cette mesure ne le voit.
 */
export const billingSyncBacklog = new client.Gauge({
  name: 'billing_sync_backlog',
  help: 'Pending and abandoned iDeploy plan propagations',
  labelNames: ['state', 'service'] as const,
  registers: [register],
});

export { register };
export default register;
