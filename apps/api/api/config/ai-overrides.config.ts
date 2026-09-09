/**
 * Aiguillage fin — surcharger le fournisseur ou le modèle d'UNE génération.
 *
 * Trois niveaux de décision, du plus général au plus précis. Le plus précis
 * l'emporte toujours :
 *
 *   1. la configuration de la feature  (`ai.config.ts`)      — le défaut
 *   2. `AI_DEFAULT_PROVIDER`           — bascule globale, traduite par RÔLE
 *   3. `AI_OVERRIDES`                  — surcharge ciblée, par génération
 *
 * À quoi sert le troisième niveau : une bascule globale est rarement uniforme.
 * On veut tester la plateforme sur un fournisseur tout en gardant la génération
 * de logo sur celui qui la réussit ; ou envoyer la seule section financière sur
 * un modèle de raisonnement quand tout le reste tourne au tarif bas. Sans ce
 * niveau, chaque exception demanderait une modification de code et un
 * redéploiement — donc n'aurait pas lieu.
 *
 * ── ADRESSAGE ───────────────────────────────────────────────────────────────
 *
 * La clé est le `promptType` de l'appel, qui vaut :
 *   · le NOM DE SECTION pour les générations par sections
 *     (« Financial Plan », « Market », « Color Palette »…) ;
 *   · le RÔLE D'AGENT pour le socle (« section-planner », « section-digest »,
 *     « section-repair », « coherence-audit »…) ;
 *   · le `promptType` déclaré par la feature sinon (« finance », « advisor »,
 *     « communication_flyer »…).
 *
 * La correspondance est EXACTE, puis par PRÉFIXE, puis `*`. Le préfixe compte :
 * plusieurs générations numérotent leur étape (« Logo Concept 1 », « Brand
 * Mockup 3 »), et « Logo Concept » les couvre toutes.
 *
 * ── EXEMPLES ────────────────────────────────────────────────────────────────
 *
 * Tout sur Gemini, sauf le logo qui reste sur GLM :
 *
 *   AI_DEFAULT_PROVIDER=GEMINI
 *   AI_OVERRIDES='{"logo":{"provider":"GLM"}}'
 *
 * Une seule section sur le modèle de raisonnement, le reste inchangé :
 *
 *   AI_OVERRIDES='{"Financial Plan":{"role":"reasoning"}}'
 *
 * Épingler un modèle précis pour reproduire un défaut :
 *
 *   AI_OVERRIDES='{"Market":{"provider":"GEMINI","modelName":"gemini-2.5-pro"}}'
 *
 * Faire tourner tout le socle mécanique au plus bas, sans toucher aux sections :
 *
 *   AI_OVERRIDES='{"section-digest":{"role":"mechanical"},"section-planner":{"role":"mechanical"}}'
 */

import { LLMProvider } from './ai.config';
import { AI_PROVIDERS, ModelRole, modelForRole, roleOfModel } from './ai-providers.config';

export interface AiOverride {
  /** Fournisseur imposé pour cette génération. */
  provider?: LLMProvider;
  /** Modèle imposé. Prioritaire sur `role`. */
  modelName?: string;
  /**
   * Rôle imposé, traduit en modèle chez le fournisseur retenu.
   *
   * Préférable à `modelName` dans la plupart des cas : la surcharge survit alors
   * à un changement de fournisseur, alors qu'un nom de modèle devient faux.
   */
  role?: ModelRole;
}

const VALID_ROLES = new Set<string>([
  'mechanical',
  'writing',
  'reasoning',
  'vision',
  'image',
  'ocr',
]);

let parsed: Record<string, AiOverride> | null = null;

/**
 * Table de surcharges, lue une seule fois.
 *
 * Une entrée invalide est IGNORÉE avec un avertissement plutôt que rejetée en
 * bloc : une faute de frappe dans une surcharge ne doit pas empêcher la
 * plateforme de démarrer, ni annuler les surcharges voisines qui, elles, sont
 * correctes.
 */
export function getAiOverrides(): Record<string, AiOverride> {
  if (parsed !== null) return parsed;

  const raw = process.env.AI_OVERRIDES;
  const table: Record<string, AiOverride> = {};

  if (raw) {
    try {
      const candidate = JSON.parse(raw);
      if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
        for (const [key, value] of Object.entries(candidate)) {
          const entry = normalizeOverride(value);
          if (entry) table[key] = entry;
        }
      }
    } catch {
      // JSON invalide : la plateforme démarre sans surcharge plutôt que pas
      // du tout. L'absence se voit au premier appel, dans les journaux.
    }
  }

  parsed = table;
  return table;
}

/** Réinitialise la table mémorisée. Réservé aux tests et aux scripts. */
export function resetAiOverrides(): void {
  parsed = null;
}

/**
 * Trouve la clé de surcharge qui s'applique à un `promptType`.
 *
 * Trois formes, de la plus précise à la plus large :
 *   1. correspondance EXACTE      — « Financial Plan »
 *   2. correspondance par PRÉFIXE — « Logo Concept » couvre « Logo Concept 1 »,
 *      « Logo Concept 2 »… Indispensable : plusieurs générations numérotent
 *      leur étape, et exiger la clé exacte reviendrait à les rendre
 *      inadressables.
 *   3. le joker `*`
 *
 * Entre deux préfixes qui correspondent, le PLUS LONG gagne : « Logo Variation
 * Fond Sombre » l'emporte sur « Logo Variation ».
 */
export function matchOverrideKey(
  table: Record<string, AiOverride>,
  promptType?: string
): string | undefined {
  if (promptType && table[promptType]) return promptType;

  if (promptType) {
    const prefixes = Object.keys(table)
      .filter((key) => key !== '*' && promptType.startsWith(key))
      .sort((a, b) => b.length - a.length);
    if (prefixes.length > 0) return prefixes[0];
  }

  return table['*'] ? '*' : undefined;
}

function normalizeOverride(value: unknown): AiOverride | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;

  const provider =
    typeof record.provider === 'string' && AI_PROVIDERS[record.provider as LLMProvider]
      ? (record.provider as LLMProvider)
      : undefined;

  const modelName =
    typeof record.modelName === 'string' && record.modelName.trim()
      ? record.modelName.trim()
      : undefined;

  const role =
    typeof record.role === 'string' && VALID_ROLES.has(record.role)
      ? (record.role as ModelRole)
      : undefined;

  if (!provider && !modelName && !role) return null;
  return { provider, modelName, role };
}

/**
 * Applique la surcharge correspondant à `promptType`, s'il en existe une.
 *
 * Appliquée APRÈS la bascule globale, au point de passage unique : une
 * surcharge peut donc ramener une génération précise sur le fournisseur
 * d'origine alors que tout le reste a basculé — c'est son usage principal.
 *
 * Sans entrée correspondante, renvoie la configuration inchangée.
 */
export function applyAiOverride<
  T extends { provider: LLMProvider; modelName: string },
>(config: T, promptType?: string): { config: T; applied?: string } {
  const table = getAiOverrides();
  if (Object.keys(table).length === 0) return { config };

  const key = matchOverrideKey(table, promptType);
  if (!key) return { config };

  const override = table[key];
  const provider = override.provider ?? config.provider;

  // `modelName` est explicite et l'emporte ; sinon le rôle est traduit chez le
  // fournisseur retenu ; sinon on garde le modèle courant.
  let modelName = config.modelName;
  if (override.modelName) {
    modelName = override.modelName;
  } else if (override.role) {
    modelName = modelForRole(provider, override.role) ?? config.modelName;
  } else if (override.provider && override.provider !== config.provider) {
    // Fournisseur changé sans modèle ni rôle précisé — le cas le plus courant :
    // « ramène le logo sur GLM ». On traduit le modèle courant par son RÔLE,
    // sinon on enverrait un nom que le nouveau fournisseur ne connaît pas.
    modelName = modelForRole(provider, roleOfModel(config.modelName)) ?? config.modelName;
  }

  return {
    config: { ...config, provider, modelName },
    applied: `${key} → ${provider}/${modelName}`,
  };
}
