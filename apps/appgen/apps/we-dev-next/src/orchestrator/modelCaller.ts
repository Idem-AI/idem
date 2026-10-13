/**
 * Un appel de modèle qui ne se contente pas de la première réponse.
 *
 * Partagé par tous les agents de l'orchestrateur (rédaction, mise en page,
 * médias, dessin) : chaîne de repli entre modèles, jugement de chaque réponse,
 * nouvel essai avec ce qu'il faut corriger, récupération au dernier essai.
 */

import { generateText } from 'ai';
import { getFallbackModelKeys, resolveModelCredentials } from '../config/modelConfig.js';
import { getOpenAIModel } from '../services/aiService.js';
import { reportUsage } from '../utils/tokens.js';
import { ChatLogger } from '../utils/logger.js';
import { isTransientModelError, shouldTryNextModel } from '../utils/resilientStream.js';
import { readJsonObject } from './sectionSpecs.js';

/** Essais par tâche, tous modèles confondus. */
const MAX_ATTEMPTS = 3;
/** Au-delà, l'appel est abandonné et le modèle suivant prend la main. */
const CALL_TIMEOUT_MS = 45_000;

export interface CallOutcome<T> {
  value: T | null;
  model?: string;
  attempts: number;
  /** Tous les essais ont échoué côté fournisseur (saturation, réseau), aucun sur le contenu. */
  providerDown: boolean;
  /** La réponse retenue a été récupérée en retirant des phrases non vérifiées. */
  salvaged?: boolean;
}

/**
 * Le jugement d'une réponse : acceptée, ou refusée avec ce qu'il faut dire au
 * modèle pour l'essai suivant — et, s'il y a lieu, de quoi la récupérer quand
 * les essais sont épuisés.
 */
export type Verdict<T> = { value: T } | { problem: string; salvage?: () => T | null };

export const SHAPE_REMINDER =
  'Votre réponse précédente était inutilisable. Renvoyez UNIQUEMENT l’objet JSON demandé, complet, avec toutes ses clés, sans texte autour ni bloc de code.';

/** Après deux pannes dans la même construction, un modèle cède sa place pour la suite. */
const FAILURES_BEFORE_DEMOTION = 2;

/**
 * Appelle les modèles de la chaîne de repli jusqu'à obtenir une réponse qui
 * passe la vérification.
 *
 * Une panne (503, délai dépassé) fait passer la section au modèle suivant. Un
 * modèle qui tombe deux fois est écarté pour le reste de la construction : les
 * sections suivantes ne repassent pas par lui pour rien. Une seule panne ne
 * suffit pas — elle est souvent passagère, et changer de modèle en cours de
 * site change aussi sa voix.
 */
export class ModelCaller {
  private readonly chain: string[];
  private readonly failures = new Map<string, number>();
  promptTokens = 0;
  completionTokens = 0;

  constructor(
    preferred: string,
    private readonly userId: string | null,
    private readonly signal: AbortSignal
  ) {
    this.chain = getFallbackModelKeys(preferred);
  }

  private order(): string[] {
    const available = this.chain.filter(
      (model) => (this.failures.get(model) ?? 0) < FAILURES_BEFORE_DEMOTION
    );
    return available.length ? available : this.chain;
  }

  /** Une réponse JSON : lue (blocs de code et virgules finales tolérés), puis jugée. */
  json<T>(
    label: string,
    system: string,
    prompt: string,
    judge: (raw: unknown) => Verdict<T>,
    maxTokens = 1400
  ): Promise<CallOutcome<T>> {
    return this.call(label, system, prompt, (text) => judge(readJsonObject(text)), maxTokens);
  }

  /**
   * Une réponse en texte libre, jugée telle quelle : un dessin SVG, par
   * exemple, qui n'a rien à faire dans un objet JSON.
   */
  async call<T>(
    label: string,
    system: string,
    prompt: string,
    judge: (text: string) => Verdict<T>,
    maxTokens = 1400,
    temperature = 0.7
  ): Promise<CallOutcome<T>> {
    let attempts = 0;
    let providerErrors = 0;
    let reminder = '';
    let salvage: { run: () => T | null; model: string } | undefined;

    const order = this.order();

    for (const [index, model] of order.entries()) {
      // Le premier modèle a droit à un second essai sur le contenu ; les
      // suivants, à un seul. Trois essais au total, jamais davantage.
      const tries = index === 0 ? 2 : 1;

      for (let attempt = 0; attempt < tries && attempts < MAX_ATTEMPTS; attempt++) {
        if (this.signal.aborted) return { value: null, attempts, providerDown: false };
        attempts += 1;

        const controller = new AbortController();
        const abort = () => controller.abort();
        this.signal.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, CALL_TIMEOUT_MS);
        const started = Date.now();

        try {
          const { apiKey, apiUrl } = resolveModelCredentials(model);
          const result = await generateText({
            model: getOpenAIModel(apiUrl, apiKey, model),
            system,
            prompt: reminder ? `${prompt}\n\n${reminder}` : prompt,
            maxTokens,
            temperature,
            maxRetries: 0,
            abortSignal: controller.signal,
          });

          this.promptTokens += result.usage?.promptTokens ?? 0;
          this.completionTokens += result.usage?.completionTokens ?? 0;
          reportUsage({
            model,
            mode: 'builder-site',
            promptTokens: result.usage?.promptTokens,
            completionTokens: result.usage?.completionTokens,
            finishReason: result.finishReason,
            userId: this.userId,
          });

          const verdict = judge(result.text);
          if ('value' in verdict) {
            ChatLogger.info('SITE_SECTION', `${label} rédigée`, {
              model,
              attempts,
              ms: Date.now() - started,
            });
            return { value: verdict.value, model, attempts, providerDown: false };
          }

          ChatLogger.warn('SITE_SECTION', `${label} : réponse refusée`, {
            model,
            attempt: attempts,
            problem: verdict.problem.slice(0, 200),
            preview: result.text.slice(0, 160),
          });
          reminder = verdict.problem;
          if (verdict.salvage) salvage = { run: verdict.salvage, model };
        } catch (error) {
          if (this.signal.aborted) return { value: null, attempts, providerDown: false };
          providerErrors += 1;
          ChatLogger.warn('SITE_SECTION', `${label} : ${model} en échec`, {
            transient: isTransientModelError(error),
            message: error instanceof Error ? error.message.slice(0, 200) : String(error),
          });
          // Saturation, modèle retiré, délai dépassé : le suivant de la chaîne
          // pour cette section, et un échec de plus au compte de ce modèle.
          if (shouldTryNextModel(error) || controller.signal.aborted) {
            this.failures.set(model, (this.failures.get(model) ?? 0) + 1);
          }
          break;
        } finally {
          clearTimeout(timer);
          this.signal.removeEventListener('abort', abort);
        }
      }

      if (attempts >= MAX_ATTEMPTS) break;
    }

    // Essais épuisés sur une réponse presque bonne : on garde ce qui est
    // vérifié plutôt que de perdre la section entière.
    const recovered = salvage?.run() ?? null;
    if (recovered !== null) {
      ChatLogger.info('SITE_SECTION', `${label} récupérée (phrases non vérifiées retirées)`, {
        model: salvage!.model,
        attempts,
      });
      return { value: recovered, model: salvage!.model, attempts, providerDown: false, salvaged: true };
    }

    return { value: null, attempts, providerDown: attempts > 0 && providerErrors === attempts };
  }
}

