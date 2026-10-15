/**
 * IDEM, hôte du moteur de génération graphique (@idem/graphic-engine).
 *
 * Le moteur est un paquet du monorepo : l'IA y écrit en HTML Tailwind les pages du business plan, de la
 * charte graphique, du pitch deck, les faces des cartes de visite et les visuels. Il demande à son hôte
 * quelques branchements, posés ici une fois pour toutes :
 *  · l'appel d'agent — le runtime d'agents d'IDEM : le rôle et le cran choisissent le modèle (échelles) ;
 *  · le journal winston, et les traces de génération (coûts, décisions, corrections) en JSON ;
 *  · la mémoire entre documents (Redis) — les idées déjà employées pour une marque, pour faire autrement — et le
 *    langage visuel de la marque, écrit une fois par charte et relu par tous ses livrables ;
 *  · le Chromium partagé du service PDF, et la garde réseau des rendus ;
 *  · les fournisseurs de médias (génération, banque d'images) du planificateur de médias, et le registre
 *    des ressources du projet, commun aux documents et aux vidéos.
 *
 * Importer ce module suffit (effet de bord idempotent). Tout est paresseux : rien ne se connecte avant
 * la première page.
 */
import { configureGraphicEngine, FingerprintScope, GenerationTrace } from '@idem/graphic-engine';
import logger from '../../config/logger';
import { cacheService } from '../cache.service';
import { runtimeCall } from '../creativity/orchestrator';
import { isRenderUrlAllowed } from '../../utils/render-network-guard';
import { IDEM_ASSET_PROVIDERS } from './asset-providers';
import { idemAssetRegistry } from './asset-registry';

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
    // Le langage visuel de la marque (écrit une fois par charte, relu par tous ses livrables) : 180 jours ; la clé
    // change avec la charte, une nouvelle charte écrit donc un nouveau langage.
    brandMemory: {
      read: async (key) => (await cacheService.get<string>(`brand-language:${key}`, { prefix: 'graphic' })) ?? undefined,
      write: async (key, value) => {
        await cacheService.set(`brand-language:${key}`, value, { prefix: 'graphic', ttl: 180 * 24 * 3600 });
      },
    },
    assetProviders: IDEM_ASSET_PROVIDERS,
    // Le registre du projet : une image déjà obtenue (deck, visuel, vidéo) est reprise avant d'être regénérée.
    assetRegistry: idemAssetRegistry,
    browser: {
      // Le Chromium du service PDF : un seul navigateur de rendu par processus.
      shared: async () => (await import('../pdf.service')).PdfService.sharedBrowser(),
      // Les images publiques d'un visuel passent ; le réseau interne, jamais.
      allow: (url) => isRenderUrlAllowed(url),
    },
  });
}

configureGraphicEngineForIdem();
