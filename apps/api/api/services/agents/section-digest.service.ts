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

const DIGEST_SYSTEM_PROMPT = `You are a fact extractor. You are given one section of a business deliverable.
You produce a COMPACT brief for other writers who must stay consistent with that section.

Rules:
- 120 words maximum, in short bullets.
- FACTS only: figures, amounts and currencies, dates, proper nouns, customer segments, prices, channels, commitments made.
- No pleasantries, no analysis, no HTML, no headings.
- Write the brief in the SAME LANGUAGE as the section.
- Any figure present must appear verbatim (same units, same currency).`;

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

// ── Digest construit PAR LE CODE depuis le contenu structuré (diagnostic S1, 18/11/2026) ─────────────────────────
//
// Une section sous gabarit existe d'abord en OBJET (titres, blocs, chiffres) avant d'être rendue en HTML. Ses faits
// s'en extraient sans modèle : titres, valeurs et libellés des blocs, phrases chiffrées ou nommées de la prose.

/** Les sections rendues de ce processus, par leur HTML : l'objet dont elles viennent (borné, plus ancien retiré). */
const STRUCTURED = new Map<string, unknown>();
const STRUCTURED_MAX = 300;

/** À appeler quand une section structurée vient d'être rendue : ses digests se feront sans modèle. */
export function rememberStructured(renderedHtml: string, section: unknown): void {
  if (!renderedHtml || !section) return;
  STRUCTURED.set(hashContent(renderedHtml), section);
  if (STRUCTURED.size > STRUCTURED_MAX) STRUCTURED.delete(STRUCTURED.keys().next().value as string);
}

/** Les faits d'une section structurée, en lignes courtes (0 jeton). */
export function digestFromStructured(section: unknown, max = MAX_DIGEST_CHARS * 1.4): string {
  const lines: string[] = [];
  let size = 0;
  const push = (line: string) => {
    const t = line.replace(/\s+/g, ' ').trim();
    if (!t || size >= max || lines.includes(t)) return;
    lines.push(t);
    size += t.length + 1;
  };
  const isFact = (sentence: string) => /\d/.test(sentence) || /\s[A-ZÀ-Ý][\p{L}'’-]{2,}/u.test(sentence);
  const walk = (v: unknown, key = '', depth = 0): void => {
    if (depth > 6 || size >= max) return;
    if (typeof v === 'string') {
      if (/^(type|id|kind|variant|layout|icon|tone|style|chart|accent)$/i.test(key)) return;
      if (v.length <= 90) push(v);
      else for (const sentence of v.split(/(?<=[.!?…])\s+/)) if (isFact(sentence)) push(sentence.slice(0, 220));
      return;
    }
    if (typeof v === 'number') return push(`${key}: ${v}`);
    if (Array.isArray(v)) {
      // Une rangée de tableau ou un élément de liste : sur une ligne, lisible.
      if (v.every((x) => typeof x === 'string' || typeof x === 'number')) return push(v.join(' · ').slice(0, 220));
      for (const x of v.slice(0, 24)) walk(x, key, depth + 1);
      return;
    }
    if (v && typeof v === 'object') {
      const o = v as Record<string, unknown>;
      // Une paire valeur / libellé (bloc de chiffres) : une ligne.
      if ((typeof o.value === 'string' || typeof o.value === 'number') && typeof o.label === 'string') return push(`${o.label} : ${o.value}`);
      for (const [k, x] of Object.entries(o)) walk(x, k, depth + 1);
    }
  };
  walk(section);
  return lines.join('\n');
}

/** Les digests en cours, par clé : deux étapes qui dépendent de la même section n'en paient qu'un (diagnostic S2). */
const INFLIGHT = new Map<string, Promise<SectionDigest>>();

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

  // La section est connue sous sa forme structurée : ses faits s'extraient par le code, sans modèle (S1).
  const structured = STRUCTURED.get(hashContent(content ?? ''));
  if (structured) {
    const facts = digestFromStructured(structured);
    if (facts) {
      logAIEvent('agent.digest_built', { projectId: ctx.projectId, section: name, sourceChars: plain.length, digestChars: facts.length, ratio: Math.round(plain.length / Math.max(1, facts.length)), by: 'code' });
      return { name, text: facts, origin: 'deterministic' };
    }
  }

  const cacheKey = `digest:${ctx.projectId ?? 'anon'}:${name}:${hashContent(plain)}`;
  const pending = INFLIGHT.get(cacheKey);
  if (pending) return pending;
  const run = digestByModel(name, plain, cacheKey, ctx).finally(() => INFLIGHT.delete(cacheKey));
  INFLIGHT.set(cacheKey, run);
  return run;
}

/** Le résumé au modèle (section HTML libre, sans forme structurée connue), en cache par empreinte. */
async function digestByModel(name: string, plain: string, cacheKey: string, ctx: DigestContext): Promise<SectionDigest> {
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
