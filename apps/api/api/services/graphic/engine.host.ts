/**
 * IDEM, hôte du moteur de génération graphique (@idem/graphic-engine).
 *
 * Le moteur est un paquet du monorepo : il compose, mesure et répare les pages du business plan, de la
 * charte graphique, du pitch deck, les faces des cartes de visite et les visuels. Il demande à son hôte
 * quelques branchements, posés ici une fois pour toutes :
 *  · l'appel d'agent — le runtime d'agents d'IDEM (étages, escalade, suivi d'usage), aux crans High+ ;
 *  · le modèle de vision — la critique visuelle des crans High+ ;
 *  · le journal winston, et les traces de génération (coûts, décisions, réparations) en JSON ;
 *  · la mémoire de diversité entre documents (Redis) — deux livrables d'une marque ne se ressemblent pas ;
 *  · le Chromium partagé du service PDF, et la garde réseau des rendus ;
 *  · les fournisseurs de médias (génération, banque d'images) du planificateur de médias.
 *
 * Importer ce module suffit (effet de bord idempotent). Tout est paresseux : rien ne se connecte avant
 * la première page.
 */
import { configureGraphicEngine, FingerprintScope, GenerationTrace } from '@idem/graphic-engine';
import logger from '../../config/logger';
import { cacheService } from '../cache.service';
import { runtimeCall } from '../creativity/orchestrator';
import { idemAnalyzeImage } from '../ivision/host';
import { isRenderUrlAllowed } from '../../utils/render-network-guard';
import { IDEM_ASSET_PROVIDERS } from './asset-providers';

let configured = false;

/** Les empreintes d'une portée (marque, projet) : 30 jours, les 40 dernières. */
const FINGERPRINT_TTL = 30 * 24 * 3600;
const fingerprintKey = (scope: FingerprintScope): string => `graphic-fingerprints:${scope.documentType}:${scope.key}`;

function traceSummary(trace: GenerationTrace): Record<string, unknown> {
  const llm = trace.tasks.filter((t) => t.source === 'llm');
  return {
    event: 'graphic.trace',
    generationId: trace.generationId,
    documentType: trace.documentType,
    format: trace.format,
    // Le cran de créativité — jamais sous la clé `level`, qui est le niveau du journal (winston la fusionne).
    creativity: trace.level,
    section: trace.sectionId,
    pattern: trace.pattern,
    quality: trace.quality,
    agentCalls: llm.length,
    inputTokens: llm.reduce((s, t) => s + t.inputTokens, 0),
    outputTokens: llm.reduce((s, t) => s + t.outputTokens, 0),
    repairs: trace.repairs.map((r) => r.code),
    // La provenance des médias de la page (`assetId ← source (fournisseur)`).
    ...(trace.assets?.length ? { assets: trace.assets } : {}),
    attempts: trace.attempts,
    ms: trace.ms,
  };
}

export function configureGraphicEngineForIdem(): void {
  if (configured) return;
  configured = true;
  configureGraphicEngine({
    agentCall: (ctx) => runtimeCall(ctx),
    // Le modèle de vision par défaut d'IDEM : la critique ne demande qu'un petit JSON.
    analyzeImage: (base64, mimeType, instruction, options) => idemAnalyzeImage(base64, mimeType, instruction, { maxOutputTokens: options?.maxOutputTokens }),
    logger: {
      info: (message, meta) => logger.info(message, meta),
      warn: (message, meta) => logger.warn(message, meta),
      error: (message, meta) => logger.error(message, meta),
    },
    onTrace: (trace) => logger.info('graphic.trace', traceSummary(trace)),
    recentFingerprints: async (scope) => (await cacheService.get<string[]>(fingerprintKey(scope), { prefix: 'graphic' })) ?? [],
    rememberFingerprints: async (scope, fingerprints) => {
      const previous = (await cacheService.get<string[]>(fingerprintKey(scope), { prefix: 'graphic' })) ?? [];
      await cacheService.set(fingerprintKey(scope), [...previous, ...fingerprints].slice(-40), { prefix: 'graphic', ttl: FINGERPRINT_TTL });
    },
    assetProviders: IDEM_ASSET_PROVIDERS,
    browser: {
      // Le Chromium du service PDF : un seul navigateur de rendu par processus.
      shared: async () => (await import('../pdf.service')).PdfService.sharedBrowser(),
      // Les images publiques d'un visuel passent ; le réseau interne, jamais.
      allow: (url) => isRenderUrlAllowed(url),
    },
  });
}

configureGraphicEngineForIdem();
