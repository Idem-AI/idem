/**
 * Digests de sections — ce qui rend la cohérence inter-sections ABORDABLE.
 *
 * Le problème résolu ici: pour qu'une section « Marketing & Ventes » soit
 * cohérente avec « Cible » et « Produits », elle doit savoir ce qu'elles
 * disent. La solution naïve — leur passer le texte intégral — fait exploser le
 * coût: les sections d'IDEM sont des PAGES HTML+Tailwind de 10 à 20k tokens, et
 * un pipeline de 9 sections qui se passent tout finit en coût quadratique
 * (c'est exactement ce que faisait `contextFromPreviousSteps`).
 *
 * Un digest est une réduction de ~15 à 30× d'une section: les faits, les
 * chiffres, les noms, les engagements. Ni HTML, ni mise en forme, ni prose.
 *
 * Deux niveaux, encore une fois du gratuit vers le payant:
 *   1. extraction déterministe du texte (suppression du balisage) — si le texte
 *      utile tient déjà dans le budget, c'est fini, ça n'a rien coûté ;
 *   2. sinon, un résumé factuel au tier XS, mis en cache par empreinte de
 *      contenu (une régénération partielle ne repaie pas les digests inchangés).
 */

import crypto from 'crypto';
import logger from '../../config/logger';
import { logAIEvent } from '../../utils/ai-trace.util';
import { cacheService } from '../cache.service';
import { runAgentPrompt } from './agent-runtime';
import { RunBudget } from './run-budget';
import { stripMarkup } from './text-extract';

export { stripMarkup };

/** Budget d'un digest. Au-delà, on résume au modèle. */
const MAX_DIGEST_CHARS = 900;
/** Durée de vie d'un digest en cache (même ordre que le cache de génération). */
const DIGEST_TTL_SECONDS = 7200;
/** Au-delà, on tronque avant d'envoyer au résumeur (inutile de payer le superflu). */
const MAX_SOURCE_CHARS = 40_000;

const DIGEST_SYSTEM_PROMPT = `Tu es un extracteur de faits. On te donne une section d'un livrable d'entreprise.
Tu produis une fiche COMPACTE destinée à d'autres rédacteurs qui doivent rester cohérents avec cette section.

Règles:
- Maximum 120 mots, en puces courtes.
- Uniquement des FAITS: chiffres, montants et devises, dates, noms propres, segments de clientèle, prix, canaux, engagements pris.
- Aucune formule de politesse, aucune analyse, aucun HTML, aucun titre.
- Si un chiffre est présent, il doit apparaître tel quel (mêmes unités, même devise).`;

export interface DigestContext {
  userId?: string;
  projectId?: string;
  budget?: RunBudget;
  language?: string;
}

export interface SectionDigest {
  name: string;
  text: string;
  origin: 'deterministic' | 'model' | 'cache';
}

function hashContent(content: string): string {
  return crypto.createHash('sha1').update(content).digest('hex').slice(0, 16);
}

/**
 * Digest d'une section. Ne lève jamais: en cas d'échec du résumeur, on retombe
 * sur une troncature du texte extrait — dégradée, mais toujours exploitable.
 */
export async function digestSection(
  name: string,
  content: string,
  ctx: DigestContext = {}
): Promise<SectionDigest> {
  const plain = stripMarkup(content ?? '');

  if (plain.length === 0) {
    return { name, text: '(section vide)', origin: 'deterministic' };
  }

  if (plain.length <= MAX_DIGEST_CHARS) {
    return { name, text: plain, origin: 'deterministic' };
  }

  const cacheKey = `digest:${ctx.projectId ?? 'anon'}:${name}:${hashContent(plain)}`;
  try {
    const cached = await cacheService.get<string>(cacheKey, { prefix: 'ai' });
    if (cached) {
      return { name, text: cached, origin: 'cache' };
    }
  } catch (error: any) {
    logger.debug(`Digest cache miss/erreur pour "${name}": ${error?.message}`);
  }

  // Budget épuisé: on ne bloque pas la génération pour un résumé, on dégrade.
  if (ctx.budget?.exhausted) {
    return { name, text: truncate(plain), origin: 'deterministic' };
  }

  try {
    const result = await runAgentPrompt(
      {
        role: 'section-digest',
        task: 'digest',
        systemPrompt: DIGEST_SYSTEM_PROMPT,
        promptType: 'section-digest',
        llmOptions: { maxOutputTokens: 400, temperature: 0.1 },
      },
      `SECTION: ${name}\n\n${plain.slice(0, MAX_SOURCE_CHARS)}`,
      {
        userId: ctx.userId,
        projectId: ctx.projectId,
        element: `digest:${name}`,
        budget: ctx.budget,
        language: ctx.language,
      }
    );

    const digest = result.text.trim() || truncate(plain);
    logAIEvent('agent.digest_built', {
      projectId: ctx.projectId,
      section: name,
      sourceChars: plain.length,
      digestChars: digest.length,
      ratio: Math.round(plain.length / Math.max(1, digest.length)),
    });

    await cacheService
      .set(cacheKey, digest, { prefix: 'ai', ttl: DIGEST_TTL_SECONDS })
      .catch(() => undefined);

    return { name, text: digest, origin: 'model' };
  } catch (error: any) {
    logger.warn(`Digest IA impossible pour "${name}" (${error?.message}) — repli sur troncature.`);
    return { name, text: truncate(plain), origin: 'deterministic' };
  }
}

function truncate(text: string): string {
  return `${text.slice(0, MAX_DIGEST_CHARS)}…`;
}

/**
 * Contexte inter-sections prêt à injecter dans un prompt: les digests des
 * sections dont dépend l'étape courante, et rien d'autre.
 *
 * C'est le remplaçant direct de l'ancienne concaténation intégrale.
 */
export async function buildDependencyContext(
  dependencies: { name: string; content: string }[],
  ctx: DigestContext = {}
): Promise<string> {
  if (dependencies.length === 0) return '';

  const digests = await Promise.all(
    dependencies.map((dependency) => digestSection(dependency.name, dependency.content, ctx))
  );

  return digests.map((digest) => `## ${digest.name}\n${digest.text}`).join('\n\n');
}
