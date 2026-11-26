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
import { capabilitiesFor, CAPABILITIES, describeCapabilities, type CapabilityId } from './capabilities.js';

export type Intent = Exclude<CapabilityId, 'fix'> | 'none';

/** Les déroulés que l'agent peut choisir : toutes les capacités, sauf la correction d'erreurs (bouton de l'aperçu). */
const INTENTS: Intent[] = [...CAPABILITIES.map((c) => c.id).filter((id): id is Exclude<CapabilityId, 'fix'> => id !== 'fix'), 'none'];

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
  /** L'adresse du site d'origine, quand le projet est né d'une refonte (rend « relire le site » possible). */
  siteSource?: string;
}

/** En dessous, la demande suit son chemin habituel : mieux vaut construire que poser une question à tort. */
export const INTENT_THRESHOLD = 0.7;
const TIMEOUT_MS = 8_000;

/**
 * La consigne de l'agent, écrite à partir du catalogue (`capabilities.ts`) : seules les capacités disponibles dans ce
 * contexte lui sont proposées (pas de « relire le site » sans site d'origine, pas de reprise sans génération coupée).
 */
function systemFor(context: IntentContext): string {
  const available = capabilitiesFor({ ...context, unfinished: !!context.unfinished }).filter((c) => c.id !== 'fix');
  return `You classify ONE message sent to iCode, a tool that builds websites and apps by chat, into the workflow that serves it. Answer ONLY JSON: {"intent": "...", "url": "... or null", "languages": [], "confidence": 0..1}.
Workflows available now:
${describeCapabilities(available)}
- "none": anything else — building or editing a site or an app (texts, images, sections, colours, layout), a question, a bug. When in doubt: "none".
Judge what the person wants to obtain, whatever their words; never look for keywords.
"url": the address of the site to redesign if the message contains it, else null. "languages": for "translate", the ISO 639-1 codes asked (["en", "es"]), else []. "confidence": how sure you are.`;
}

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
      `Context: ${context.hasProject ? 'an IDEM project is open' : 'no project yet'}; ${context.hasSite ? 'a site is already built here' : 'nothing built yet'}${context.siteSource ? `; this project was rebuilt from the website ${context.siteSource}` : ''}${context.languages?.length ? ` (languages: ${context.languages.join(', ')})` : ''}; ${context.hasCharter ? 'brand guidelines exist' : 'no brand guidelines'}; building ${context.product ?? 'unspecified'}; ${context.unfinished ? 'the last generation was INTERRUPTED before the end' : 'no interrupted generation'}.`,
      `Message: """${text.slice(0, 1500)}"""`,
    ].join('\n');
    const outcome = await caller.call(
      'intent',
      systemFor(context),
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
