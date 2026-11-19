/**
 * Un appel de modèle qui ne se contente pas de la première réponse.
 *
 * Partagé par tous les agents de l'orchestrateur (rédaction, mise en page,
 * médias, dessin) : chaîne de repli entre modèles, jugement de chaque réponse,
 * nouvel essai avec ce qu'il faut corriger, récupération au dernier essai.
 */

import { generateText, streamText, type LanguageModelV1 } from 'ai';
import { getFallbackModelKeys, resolveModelCredentials } from '../config/modelConfig.js';
import { getOpenAIModel } from '../services/aiService.js';
import { reportUsage } from '../utils/tokens.js';
import { logCritical } from '../config/logger.js';
import { ChatLogger } from '../utils/logger.js';
import { isTransientModelError, shouldTryNextModel, isAccountLimitError } from '../utils/resilientStream.js';
import { readJsonObject } from './json.js';

/** Essais par tâche, tous modèles confondus. */
const MAX_ATTEMPTS = 3;
/** Au-delà, l'appel est abandonné et le modèle suivant prend la main. */
const CALL_TIMEOUT_MS = 90_000;

export interface CallOutcome<T> {
  value: T | null;
  model?: string;
  attempts: number;
  /** Tous les essais ont échoué côté fournisseur (saturation, réseau), aucun sur le contenu. */
  providerDown: boolean;
  /** La réponse retenue a été récupérée en retirant des phrases non vérifiées. */
  salvaged?: boolean;
  /** Le compte du fournisseur a refusé l'appel (plafond, crédits) : rien ne passera avant qu'il soit relevé. */
  accountLimit?: boolean;
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
/** Ce que la personne lit quand le compte du fournisseur bloque tout : la vérité, pas « réessayez dans un instant ». */
export const accountLimitMessage = (fr: boolean): string =>
  fr
    ? 'Le service d’IA d’IDEM a atteint sa limite de dépense : aucune modification n’est possible pour le moment. L’équipe IDEM est prévenue, et votre site n’a pas changé.'
    : 'IDEM’s AI service has reached its spending limit: no change can be made for now. The IDEM team has been alerted, and your site is unchanged.';

/** Une alerte de compte bloqué par quart d'heure au plus : la règle Grafana envoie un e-mail à la première. */
let lastAccountAlert = 0;

/**
 * LA RELANCE DES APPELS LENTS. Le temps d'un appel a une longue traîne : la plupart répondent en quelques secondes,
 * quelques-uns en plus d'une minute (73 s pour une page de textes, mesuré le 12/11/2026, quand ses voisines en
 * prenaient 5). Au-delà d'un délai, le même appel part une seconde fois, et la première réponse gagne ; l'autre est
 * coupée. Rien ne change quand tout va bien : la relance ne part que pour les appels déjà en retard.
 *
 * Le délai suit ce que cette génération a mesuré : trois fois le temps médian d'un appel de même taille, entre 12 et
 * 60 s. Sans mesure encore : 25 s (40 s pour un gros appel). `SITE_HEDGE=off` la coupe.
 */
const HEDGE_MIN_MS = 12_000;
const HEDGE_MAX_MS = 60_000;
const HEDGE_FACTOR = 3;

export interface CallerOptions {
  /** Le modèle d'une clé, à la place du fournisseur : pour les contrôles, sans appel payant. */
  model?: (key: string) => LanguageModelV1;
  /** La relance des appels lents (par défaut : oui, sauf `SITE_HEDGE=off`). */
  hedge?: boolean;
  /** Le délai de relance, imposé (contrôles). */
  hedgeAfterMs?: number;
}

/** Ce que rend un essai : le texte, la consommation, et s'il a été gagné par la relance. */
interface AttemptResult {
  text: string;
  promptTokens?: number;
  completionTokens?: number;
  finishReason?: string;
  hedged?: boolean;
}

export class ModelCaller {
  private readonly chain: string[];
  private readonly failures = new Map<string, number>();
  /** Les durées des appels réussis, rapportées à leur plafond de jetons (ms par 1 000 jetons demandés). */
  private readonly pace: number[] = [];
  promptTokens = 0;
  completionTokens = 0;
  /** Les appels gagnés par leur relance : ce que la relance a fait gagner, pour les journaux. */
  hedgeWins = 0;
  /**
   * Le compte du fournisseur refuse tout (plafond de la clé, crédits épuisés) : plus aucun appel n'est tenté, et
   * l'appelant le dit tel quel au lieu de « réessayez dans un instant ».
   */
  accountLimit = false;

  constructor(
    preferred: string,
    private readonly userId: string | null,
    private readonly signal: AbortSignal,
    private readonly options: CallerOptions = {}
  ) {
    this.chain = getFallbackModelKeys(preferred);
  }

  /** Le délai après lequel un appel de cette taille est relancé. */
  hedgeDelay(maxTokens: number): number {
    if (this.options.hedgeAfterMs !== undefined) return this.options.hedgeAfterMs;
    if (!this.pace.length) return maxTokens > 3000 ? 40_000 : 25_000;
    const sorted = [...this.pace].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    return Math.round(Math.min(HEDGE_MAX_MS, Math.max(HEDGE_MIN_MS, (median * maxTokens * HEDGE_FACTOR) / 1000)));
  }

  private hedgeEnabled(): boolean {
    if (this.options.hedge !== undefined) return this.options.hedge;
    return (process.env.SITE_HEDGE ?? 'on').toLowerCase() !== 'off';
  }

  private modelFor(key: string): LanguageModelV1 {
    if (this.options.model) return this.options.model(key);
    const { apiKey, apiUrl } = resolveModelCredentials(key);
    return getOpenAIModel(apiUrl, apiKey, key) as LanguageModelV1;
  }

  /**
   * Un essai : d'un bloc, ou au fil de l'eau quand `onText` est donné (le texte reçu jusque-là, à chaque morceau). Une
   * erreur du fournisseur en cours de flux est levée comme celle d'un appel d'un bloc.
   */
  private async once(
    model: string,
    request: { system: string; prompt: string; maxTokens: number; temperature: number },
    signal: AbortSignal,
    onText?: (text: string) => void
  ): Promise<AttemptResult> {
    const base = { model: this.modelFor(model), ...request, maxRetries: 0, abortSignal: signal };
    if (!onText) {
      const result = await generateText(base);
      return { text: result.text, promptTokens: result.usage?.promptTokens, completionTokens: result.usage?.completionTokens, finishReason: result.finishReason };
    }
    const result = streamText(base);
    let text = '';
    for await (const part of result.fullStream) {
      if (part.type === 'text-delta') {
        text += part.textDelta;
        onText(text);
      } else if (part.type === 'error') {
        throw part.error instanceof Error ? part.error : new Error(String(part.error));
      }
    }
    if (signal.aborted) throw new Error('aborted');
    const usage = await result.usage.catch(() => undefined);
    return { text, promptTokens: usage?.promptTokens, completionTokens: usage?.completionTokens, finishReason: await result.finishReason.catch(() => undefined) };
  }

  /**
   * Un essai, relancé s'il traîne : la première réponse gagne, l'autre est coupée. Un appel au fil de l'eau n'est
   * relancé que s'il n'a encore rien écrit (il avance, sinon) ; seul le premier qui écrit est suivi.
   */
  private attempt(
    model: string,
    request: { system: string; prompt: string; maxTokens: number; temperature: number },
    signal: AbortSignal,
    onText?: (text: string) => void
  ): Promise<AttemptResult> {
    if (!this.hedgeEnabled()) return this.once(model, request, signal, onText);
    const controllers = [new AbortController(), new AbortController()];
    const relay = () => controllers.forEach((c) => c.abort());
    signal.addEventListener('abort', relay, { once: true });
    let leader: number | null = null;
    const follow = (who: number) => (onText ? (text: string) => {
      if (leader === null) leader = who;
      if (leader === who) onText(text);
    } : undefined);

    return new Promise<AttemptResult>((resolve, reject) => {
      let settled = false;
      let running = 0;
      let firstError: unknown = null;
      const finish = () => {
        clearTimeout(timer);
        signal.removeEventListener('abort', relay);
      };
      const launch = (who: number) => {
        running += 1;
        this.once(model, request, controllers[who].signal, follow(who)).then(
          (value) => {
            if (settled) return;
            settled = true;
            finish();
            controllers[1 - who].abort();
            resolve({ ...value, hedged: who === 1 });
          },
          (error) => {
            running -= 1;
            if (settled) return;
            firstError ??= error;
            // L'autre essai court encore : on l'attend. Sinon, l'échec remonte (modèle suivant).
            if (running > 0) return;
            if (who === 0 && !hedged) {
              settled = true;
              finish();
              reject(error);
              return;
            }
            settled = true;
            finish();
            reject(firstError);
          }
        );
      };
      let hedged = false;
      const timer = setTimeout(() => {
        if (settled || signal.aborted) return;
        // Au fil de l'eau, un appel qui écrit déjà avance : pas de relance.
        if (onText && leader !== null) return;
        hedged = true;
        launch(1);
      }, this.hedgeDelay(request.maxTokens));
      launch(0);
    });
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
    maxTokens = 1400,
    /** Au fil de l'eau : le texte reçu jusque-là, à chaque morceau (une réponse en cours, pas encore jugée). */
    onText?: (text: string) => void
  ): Promise<CallOutcome<T>> {
    return this.call(label, system, prompt, (text) => judge(readJsonObject(text)), maxTokens, 0.7, MAX_ATTEMPTS, onText);
  }

  /**
   * Une réponse en texte libre, jugée telle quelle : un dessin SVG, par
   * exemple, qui n'a rien à faire dans un objet JSON.
   */
  async call<T>(
    label: string,
    system: string,
    prompt: string,
    judge: (text: string) => Verdict<T> | Promise<Verdict<T>>,
    maxTokens = 1400,
    temperature = 0.7,
    /** Essais au plus, tous modèles confondus (trois par défaut). */
    maxAttempts = MAX_ATTEMPTS,
    /** Au fil de l'eau : le texte reçu jusque-là (premier essai seulement : un nouvel essai repart de zéro). */
    onText?: (text: string) => void
  ): Promise<CallOutcome<T>> {
    // Le compte a déjà refusé un appel de cette génération : inutile d'en tenter d'autres.
    if (this.accountLimit) return { value: null, attempts: 0, providerDown: true, accountLimit: true };
    let attempts = 0;
    let providerErrors = 0;
    let reminder = '';
    let salvage: { run: () => T | null; model: string } | undefined;

    const order = this.order();

    for (const [index, model] of order.entries()) {
      // Le premier modèle a droit à un second essai sur le contenu ; les
      // suivants, à un seul. Trois essais au total, jamais davantage.
      const tries = index === 0 ? Math.max(2, maxAttempts - 2) : 1;

      for (let attempt = 0; attempt < tries && attempts < maxAttempts; attempt++) {
        if (this.signal.aborted) return { value: null, attempts, providerDown: false };
        attempts += 1;

        const controller = new AbortController();
        const abort = () => controller.abort();
        this.signal.addEventListener('abort', abort, { once: true });
        const timer = setTimeout(abort, CALL_TIMEOUT_MS);
        const started = Date.now();

        try {
          const request = { system, prompt: reminder ? `${prompt}\n\n${reminder}` : prompt, maxTokens, temperature };
          const result = await this.attempt(model, request, controller.signal, attempts === 1 ? onText : undefined);
          const ms = Date.now() - started;
          this.pace.push((ms * 1000) / Math.max(1, maxTokens));
          if (result.hedged) {
            this.hedgeWins += 1;
            ChatLogger.info('SITE_SECTION', `${label} : la relance a répondu la première`, { model, ms, after: this.hedgeDelay(maxTokens) });
          }

          this.promptTokens += result.promptTokens ?? 0;
          this.completionTokens += result.completionTokens ?? 0;
          reportUsage({
            model,
            mode: 'builder-site',
            promptTokens: result.promptTokens,
            completionTokens: result.completionTokens,
            finishReason: result.finishReason,
            userId: this.userId,
          });

          const verdict = await judge(result.text);
          if ('value' in verdict) {
            ChatLogger.info('SITE_SECTION', `${label} rédigée`, {
              model,
              attempts,
              ms,
              ...(result.hedged ? { hedged: true } : {}),
            });
            return { value: verdict.value, model, attempts, providerDown: false };
          }

          // Un renvoi pour correction fait partie du déroulé normal (le modèle a un essai de plus) : une information,
          // pas un avertissement. L'échec réel, essais épuisés, est dit plus bas.
          ChatLogger.info('SITE_SECTION', `${label} : à corriger, nouvel essai`, {
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
          if (isAccountLimitError(error)) {
            this.accountLimit = true;
            if (Date.now() - lastAccountAlert > 15 * 60_000) {
              lastAccountAlert = Date.now();
              logCritical('model.account_limit', { label, model, message: error instanceof Error ? error.message.slice(0, 300) : String(error).slice(0, 300) });
            }
            return { value: null, attempts, providerDown: true, accountLimit: true };
          }
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

      if (attempts >= maxAttempts) break;
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

