/**
 * L'AGENT QUI LIT LA DEMANDE — avant de construire, un modèle rapide se demande si le message relève d'un des
 * déroulés d'iCode (refaire un site existant, créer la charte, mettre en ligne, choisir un nom, faire connaître
 * le site). Aucune liste de mots : « mon site date de 2015, il faut le remettre au goût du jour » est une refonte,
 * « inspire-toi de stripe.com » n'en est pas une, et c'est le modèle qui en juge, avec le contexte de l'atelier.
 *
 * Rapide et borné : deux essais au plus (le second sur un autre modèle), 8 secondes en tout, réponse JSON de quelques jetons. S'il ne répond pas, la
 * demande suit son chemin habituel — l'agent n'empêche jamais de construire.
 */
import { modelForCreativity } from '../config/modelConfig.js';
import { ChatLogger } from '../utils/logger.js';
import { ModelCaller, Verdict } from '../siteEngine/modelCaller.js';
import { findSiteUrl } from '../siteEngine/redesign/intent.js';

export type Intent = 'redesign' | 'charter' | 'publish' | 'domain' | 'communication' | 'translate' | 'resume' | 'none';

const INTENTS: Intent[] = ['redesign', 'charter', 'publish', 'domain', 'communication', 'translate', 'resume', 'none'];

export interface IntentResult {
  intent: Intent;
  /** L'adresse du site à refaire, normalisée, quand la demande en donne une. */
  url?: string;
  /** Les langues demandées (`translate`), en codes ISO. */
  languages?: string[];
  confidence: number;
}

export interface IntentContext {
  hasProject: boolean;
  hasSite: boolean;
  hasCharter: boolean;
  product: 'site' | 'app' | null;
  /** Une génération s'est interrompue avant la fin (son plan n'est pas coché jusqu'au bout). */
  unfinished?: boolean;
  /** Les langues du site déjà construit. */
  languages?: string[];
}

/** En dessous, la demande suit son chemin habituel : mieux vaut construire que poser une question à tort. */
export const INTENT_THRESHOLD = 0.7;
const TIMEOUT_MS = 8_000;

const SYSTEM = `You classify ONE message sent to iCode, a tool that builds websites and apps by chat, into a workflow. Answer ONLY JSON: {"intent": "...", "url": "... or null", "languages": [], "confidence": 0..1}.
Workflows:
- "redesign": the user wants an EXISTING website of theirs rebuilt, modernised or improved as a whole (a new version of their current site). The address may or may not be given. Not: copying another site's style, editing one part of the site being built here.
- "charter": the user wants brand guidelines / a visual identity document (charte graphique) for their business.
- "publish": the user wants the site or app put online / deployed now.
- "domain": the user wants their own domain name (example.com) bought or connected.
- "communication": the user wants to promote the site on social networks, plan posts, marketing.
- "translate": the user wants the site built here available in another language (or several): "en anglais aussi", "add Spanish", "make it bilingual". Not: rewriting one text in another language, a question about languages.
- "resume": a generation was interrupted (context says so) and the user wants it to go on: "continue", "vas-y", "termine", "reprends". Only when the context says a generation is unfinished; otherwise "none".
- "none": anything else — building or editing a site or an app, a question, a bug, a style change. When in doubt: "none".
"url": the address of the site to redesign if the message contains it, else null. "languages": for "translate", the ISO 639-1 codes asked (["en", "es"]), else []. "confidence": how sure you are.`;

/** La réponse de l'agent, lue et bornée (exportée pour le contrôle sans modèle). */
export function readIntent(raw: unknown): IntentResult | null {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null;
  if (!o || !INTENTS.includes(o.intent as Intent)) return null;
  const confidence = Math.max(0, Math.min(1, Number(o.confidence) || 0));
  const url = typeof o.url === 'string' && o.url !== 'null' ? findSiteUrl(o.url)?.url : undefined;
  const languages = Array.isArray(o.languages) ? [...new Set(o.languages.map((code) => String(code).trim().slice(0, 2).toLowerCase()).filter((code) => /^[a-z]{2}$/.test(code)))] : [];
  return { intent: o.intent as Intent, confidence, ...(url ? { url } : {}), ...(languages.length ? { languages } : {}) };
}

export async function analyzeIntent(options: { text: string; context: IntentContext; userId: string | null; language: string }): Promise<IntentResult> {
  const none: IntentResult = { intent: 'none', confidence: 0 };
  if ((process.env.ICODE_INTENT_AGENT ?? 'on').toLowerCase() === 'off') return none;
  const text = options.text.trim();
  // Les longs briefs posés par le dashboard au lancement ne sont pas des demandes à aiguiller.
  if (text.length < 4 || text.length > 2500) return none;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const started = Date.now();
  try {
    const model = process.env.ICODE_INTENT_MODEL?.trim() || modelForCreativity('low');
    const caller = new ModelCaller(model, options.userId, controller.signal);
    const { context } = options;
    const prompt = [
      `Context: ${context.hasProject ? 'an IDEM project is open' : 'no project yet'}; ${context.hasSite ? 'a site is already built here' : 'nothing built yet'}${context.languages?.length ? ` (languages: ${context.languages.join(', ')})` : ''}; ${context.hasCharter ? 'brand guidelines exist' : 'no brand guidelines'}; building ${context.product ?? 'unspecified'}; ${context.unfinished ? 'the last generation was INTERRUPTED before the end' : 'no interrupted generation'}.`,
      `Message: """${text.slice(0, 1500)}"""`,
    ].join('\n');
    const outcome = await caller.call(
      'intent',
      SYSTEM,
      prompt,
      (answer): Verdict<IntentResult> => {
        const match = answer.replace(/```[a-z]*\n?/gi, '').match(/\{[\s\S]*\}/);
        try {
          const parsed = readIntent(match ? JSON.parse(match[0]) : null);
          return parsed ? { value: parsed } : { problem: 'Answer ONLY the JSON object.' };
        } catch {
          return { problem: 'Answer ONLY the JSON object.' };
        }
      },
      120,
      0,
      // Deux essais : un modèle saturé cède sa place au suivant de la chaîne, dans les 8 secondes.
      2
    );
    const result = outcome.value ?? none;
    ChatLogger.info('INTENT', 'Demande lue par l’agent', { intent: result.intent, confidence: result.confidence, url: result.url, ms: Date.now() - started });
    return result;
  } catch (error) {
    ChatLogger.warn('INTENT', 'Agent indisponible : chemin habituel', { message: (error as Error).message });
    return none;
  } finally {
    clearTimeout(timer);
  }
}
