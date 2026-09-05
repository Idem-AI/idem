/**
 * Cohérence d'une bascule de fournisseur — `npm run check:provider`.
 *
 * À lancer AVANT de démarrer l'application sur un autre fournisseur. Il répond à
 * une question précise : est-ce que chaque appel de la plateforme atterrira sur
 * un modèle que ce fournisseur sert réellement ?
 *
 * La question n'est pas rhétorique. La migration Gemini → GLM a laissé derrière
 * elle des garde-fous qui envoyaient des noms GLM à Vertex et inversement, et le
 * symptôme était un 404 loin de sa cause. Ce script rejoue la traduction sur
 * TOUTES les configurations du catalogue et signale celles qui atterriraient
 * dans le vide.
 *
 * Aucun réseau : c'est une propriété de la configuration, pas du service.
 *
 *   AI_DEFAULT_PROVIDER=GEMINI npx ts-node --transpile-only \
 *     api/scripts/checkProviderSwitch.ts
 */

import dotenv from 'dotenv';
import path from 'path';

// L'environnement RÉEL de l'application, chargé dans le même ordre qu'elle :
// `.env` puis `.env.secret`. Sans cela le script vérifierait une configuration
// qui n'est pas celle qui tournera — le pire résultat possible pour un contrôle
// de pré-démarrage.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env.secret') });
if (process.env.FIREBASE_PRIVATE_KEY) {
  process.env.FIREBASE_PRIVATE_KEY = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
}

import { AI_CONFIG, FeatureAIConfig, LLMProvider } from '../config/ai.config';
import {
  AI_PROVIDERS,
  ModelRole,
  getProvider,
  isGeminiConfigured,
  describeGeminiBackend,
  buildGeminiThinkingConfig,
  canSuppressThinking,
  modelForRole,
  resolveGlobalOverride,
  roleOfModel,
} from '../config/ai-providers.config';
import { MODEL_TIERS } from '../config/model-router';
import {
  applyAiOverride,
  getAiOverrides,
  matchOverrideKey,
} from '../config/ai-overrides.config';

let failures = 0;
let warnings = 0;

function check(label: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function warn(label: string, detail = ''): void {
  warnings += 1;
  console.log(`  ⚠ ${label}${detail ? ` — ${detail}` : ''}`);
}

/** Aplatit AI_CONFIG en couples (chemin, configuration de feature). */
function collectFeatures(): [string, FeatureAIConfig][] {
  const found: [string, FeatureAIConfig][] = [];
  const walk = (node: unknown, path: string) => {
    if (!node || typeof node !== 'object') return;
    const record = node as Record<string, unknown>;
    if (typeof record.provider === 'string' && typeof record.modelName === 'string') {
      found.push([path, record as unknown as FeatureAIConfig]);
      return;
    }
    for (const [key, value] of Object.entries(record)) {
      walk(value, path ? `${path}.${key}` : key);
    }
  };
  walk(AI_CONFIG, '');
  return found;
}

const target = process.env.AI_DEFAULT_PROVIDER as LLMProvider | undefined;

console.log('\nCohérence de la bascule de fournisseur\n');

const overrides = getAiOverrides();

if (!target && Object.keys(overrides).length === 0) {
  console.log('  Ni AI_DEFAULT_PROVIDER ni AI_OVERRIDES : chaque feature reste sur');
  console.log('  le fournisseur qu\'elle déclare. Rien à vérifier.\n');
  console.log('  Pour vérifier une bascule :');
  console.log('    AI_DEFAULT_PROVIDER=GEMINI npm run check:provider\n');
  process.exit(0);
}

if (target && !AI_PROVIDERS[target]) {
  console.error(`  ✗ Fournisseur inconnu du registre : "${target}"`);
  console.error(`    Valeurs possibles : ${Object.keys(AI_PROVIDERS).join(', ')}\n`);
  process.exit(1);
}

const effectiveTarget = target ?? LLMProvider.GLM;
const definition = getProvider(effectiveTarget);
console.log(`Cible globale : ${target ?? '— (aucune bascule)'}`);
if (definition.kind === 'gemini') {
  console.log(`Backend : ${describeGeminiBackend()}`);
}

if (Object.keys(overrides).length > 0) {
  console.log('\nSurcharges ciblées (AI_OVERRIDES) :');
  for (const [key, override] of Object.entries(overrides)) {
    const parts = [
      override.provider ? `provider=${override.provider}` : '',
      override.modelName ? `model=${override.modelName}` : '',
      override.role ? `role=${override.role}` : '',
    ].filter(Boolean);
    console.log(`     ${key.padEnd(24)} ${parts.join(' ')}`);
  }
}
console.log('');

// ─────────────────────────────────────────────────────────────────────────────
console.log('1. Identifiants');
if (target) {
  if (definition.kind === 'gemini') {
    check('le backend Gemini est configuré', isGeminiConfigured(),
      'renseigner GEMINI_BACKEND=ai-studio et GEMINI_API_KEY, ou le compte de service Vertex');
  } else {
    check(`${definition.apiKeyEnv} est renseignée`, Boolean(process.env[definition.apiKeyEnv]));
  }

  if (process.env.AI_DEFAULT_MODEL) {
    warn(
      'AI_DEFAULT_MODEL force un modèle UNIQUE',
      `"${process.env.AI_DEFAULT_MODEL}" — tous les étages sont écrasés, le routeur XS/M/S ne travaille plus. À réserver au diagnostic.`
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n2. Table des rôles');
if (target) {
  const roles: ModelRole[] = ['mechanical', 'writing', 'reasoning', 'vision', 'image', 'ocr'];
  const missing = roles.filter((role) => !modelForRole(target!, role));

  for (const role of roles) {
    const model = modelForRole(target!, role);
    console.log(`     ${role.padEnd(11)} → ${model ?? '— (non servi)'}`);
  }

  check('les trois rôles TEXTE sont servis',
    ['mechanical', 'writing', 'reasoning'].every((role) => modelForRole(target!, role as ModelRole)),
    'sans eux, aucune génération de texte ne peut aboutir');

  const mediaMissing = missing.filter((role) => ['vision', 'image', 'ocr'].includes(role));
  if (mediaMissing.length > 0) {
    warn(`rôles média non servis : ${mediaMissing.join(', ')}`,
      'les fonctionnalités concernées dégradent (elles sont gardées par `isGlmConfigured`)');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n3. Traduction de toutes les configurations du catalogue');
{
  const features = collectFeatures();
  const landed: Record<string, string[]> = {};
  const stranded: string[] = [];

  for (const [path, config] of features) {
    // Même chaîne qu'à l'exécution : bascule globale, puis surcharge ciblée.
    const switched = resolveGlobalOverride(config);
    const { config: resolved } = applyAiOverride(switched, config.promptType ?? path.split('.').pop());
    const overridden = Boolean(matchOverrideKey(overrides, config.promptType ?? path.split('.').pop()));
    if (target && resolved.provider !== target && !overridden) {
      // Atterrissage hors cible SANS surcharge : c'est un trou, pas un choix.
      stranded.push(`${path} (${config.modelName})`);
      continue;
    }
    (landed[`${resolved.provider}/${resolved.modelName}`] ??= []).push(path);
  }

  for (const [model, paths] of Object.entries(landed).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`     ${String(paths.length).padStart(2)} × ${model}`);
  }

  check(`les ${features.length} configurations atterrissent sur ${target ?? 'leur fournisseur'}`,
    stranded.length === 0,
    stranded.join(', '));

  // Limite assumée de cette vue : elle est STATIQUE. Les générations dont le
  // `promptType` est construit à l'exécution (« Logo Concept 1 », « Brand
  // Mockup 3 ») sont comptées ici sous leur configuration, alors qu'une
  // surcharge par préfixe les déroutera au moment de l'appel. Le journal
  // « Aiguillage: surcharge … » de `prompt.service` dit ce qui s'est réellement
  // passé — c'est lui qui fait foi.
  console.log('     (vue statique : les étapes numérotées sont comptées sous leur config)');

  // Le routage doit rester ÉTAGÉ : si tout atterrit sur un seul modèle, la
  // bascule a détruit ce qu'on voulait mesurer.
  check('le routage par étage survit à la bascule',
    Object.keys(landed).length >= 2,
    `${Object.keys(landed).length} modèle(s) distinct(s) — le routeur est écrasé`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n4. Étages du routeur');
if (target) {
  for (const [tier, config] of Object.entries(MODEL_TIERS)) {
    const resolved = resolveGlobalOverride({ provider: config.provider, modelName: config.modelName });
    const role = roleOfModel(config.modelName);
    console.log(`     ${tier.padEnd(2)} (${role.padEnd(10)}) → ${resolved.modelName}`);
  }

  const resolvedTiers = Object.values(MODEL_TIERS).map(
    (config) => resolveGlobalOverride({ provider: config.provider, modelName: config.modelName }).modelName
  );
  const distinct = new Set(resolvedTiers).size;

  // Deux étages qui atterrissent sur le même modèle est DÉGRADÉ, pas cassé :
  // c'est le catalogue du fournisseur qui commande, et un catalogue peut ne pas
  // offrir trois niveaux. Ce qui serait cassé, c'est UN seul modèle pour les
  // trois — le routeur n'aurait alors plus rien à router.
  check('le routeur conserve au moins deux niveaux', distinct >= 2,
    `${distinct} modèle unique pour 3 étages — le routage n'a plus d'effet`);

  if (distinct < 3) {
    warn(
      `${distinct} modèles pour 3 étages`,
      'la séparation de COÛT entre XS et M disparaît. L\'économie de RAISONNEMENT ' +
        'subsiste (l\'étage XS pose thinkingBudget: 0). Pour retrouver trois niveaux, ' +
        'renseigner IDEM_<PROVIDER>_MECHANICAL_MODEL avec un modèle « lite » disponible.'
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n5. Réglages dépendants du fournisseur');
if (target) {
  const features = collectFeatures();

  if (definition.kind === 'gemini') {
    // `thinkingBudget: 0` n'a d'effet que sur la famille 2.5 : les 3.x pilotent
    // leur réflexion par `thinkingLevel` et refusent un budget nul.
    const zeroBudget = features.filter(([, c]) => c.llmOptions?.thinkingBudget === 0);
    const inert = zeroBudget.filter(
      ([, c]) => !canSuppressThinking(resolveGlobalOverride(c).modelName)
    );
    check(
      `les ${zeroBudget.length} configurations à raisonnement coupé atterrissent sur un modèle qui sait le couper`,
      inert.length === 0,
      inert.map(([p]) => p).join(', ') +
        ' — la réflexion se décompterait de leur budget de sortie, et une réponse vide est possible'
    );

    // Un budget serré sur un modèle qui raisonne TOUJOURS est la panne décrite
    // en tête de GLM_MODELS, transposée à Gemini : la réflexion consomme
    // l'enveloppe et la réponse revient vide.
    const risky = features.filter(([, c]) => {
      const model = resolveGlobalOverride(c).modelName;
      const budget = c.llmOptions?.maxOutputTokens;
      return budget !== undefined && budget < 4000 && !canSuppressThinking(model);
    });
    if (risky.length > 0) {
      warn(
        `${risky.length} configurations à budget serré sur un modèle qui raisonne toujours`,
        risky.map(([p, c]) => `${p} (${c.llmOptions?.maxOutputTokens})`).join(', ')
      );
    }

    // `extraBody.thinking` est un contrat GLM : l'adaptateur Gemini l'ignore.
    const glmThinking = features.filter(
      ([, c]) => (c.llmOptions?.extraBody as any)?.thinking !== undefined
    );
    if (glmThinking.length > 0) {
      warn(
        `${glmThinking.length} configurations activent le raisonnement par \`extraBody.thinking\``,
        'contrat propre à GLM — ignoré par l\'adaptateur Gemini, qui raisonne par défaut. Sans effet néfaste, mais le réglage est inerte.'
      );
    }
  }

  // La chaîne de repli déclarée devient caduque : `runPrompt` la remplace par
  // celle du fournisseur cible. On vérifie que cette dernière existe.
  check('le fournisseur cible déclare une chaîne de repli',
    (definition.defaultFallbackModels ?? []).length > 0,
    'sans elle, chaque appel serait mono-coup après la bascule');

  const badFallback = (definition.defaultFallbackModels ?? []).filter(
    (model) => !Object.values(definition.models ?? {}).includes(model)
  );
  if (badFallback.length > 0) {
    warn(`replis hors table de rôles : ${badFallback.join(', ')}`,
      'vérifier qu\'ils existent bien chez ce fournisseur');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
console.log('\n6. Clés adressables par AI_OVERRIDES');
{
  // Sans cette liste, écrire une surcharge revient à deviner. La clé est le
  // `promptType` de l'appel, qui n'est pas toujours celui que la configuration
  // déclare : les générations par sections utilisent leur NOM D'ÉTAPE.
  const declared = new Set<string>();
  for (const [, config] of collectFeatures()) {
    if (config.promptType) declared.add(config.promptType);
  }

  const sectionNames = [
    'Cover Page', 'Company Summary', 'Opportunity', 'Target Audience',
    'Products & Services', 'Marketing & Sales', 'Financial Plan', 'Goal Planning', 'Appendix',
    'Cover', 'Problem', 'Solution', 'Market', 'Product', 'Business Model',
    'Traction', 'Competition', 'Team', 'Financials', 'Ask',
    'Brand Header', 'Logo Principal', 'Color Palette', 'Typography', 'Direction Artistique',
    'Logo Bonnes Pratiques',
  ];

  const dynamic = [
    'Logo Concept N', 'Logo Critique', 'Logo Revision', 'Brand Mockup N',
    'Colors Generation', 'Typography Generation', '<kind> Variation',
  ];

  const agents = [
    'section-planner', 'section-digest', 'section-repair', 'quality-repair',
    'quality-continue', 'coherence-audit', 'research', 'research-writer', 'research-verifier',
  ];

  const show = (label: string, values: string[]) => {
    console.log(`     ${label}`);
    for (let i = 0; i < values.length; i += 3) {
      console.log('       ' + values.slice(i, i + 3).map((v) => v.padEnd(26)).join(''));
    }
  };

  show('promptType déclarés en configuration :', [...declared].sort());
  show('noms de section (générations par sections) :', sectionNames);
  show('étapes numérotées — s\'adressent par PRÉFIXE :', dynamic);
  show('rôles du socle :', agents);

  console.log('');
  console.log('     Exemples :');
  console.log('       AI_OVERRIDES=\'{"Logo Concept":{"provider":"GLM"}}\'');
  console.log('       AI_OVERRIDES=\'{"Financial Plan":{"role":"reasoning"}}\'');
  console.log('       AI_OVERRIDES=\'{"section-digest":{"role":"mechanical"},"*":{"role":"writing"}}\'');
}

// ─────────────────────────────────────────────────────────────────────────────
// SONDE RÉELLE — la seule vérification qu'aucune analyse statique ne remplace.
//
// Un modèle peut être parfaitement nommé, référencé dans la documentation, et
// refusé par le fournisseur : « no longer available to new users ». Le symptôme
// arrive alors en pleine génération, sous forme de 404 loin de sa cause, après
// que la chaîne de repli s'est épuisée sur des modèles eux aussi indisponibles.
//
// Un appel d'un token par modèle suffit à l'attester. C'est le seul contrôle de
// ce script qui coûte quelque chose — d'où l'activation explicite.
//
//   AI_PROBE=1 npm run check:provider
// ─────────────────────────────────────────────────────────────────────────────
async function probeModels(): Promise<void> {
  console.log('\n7. Sonde réelle (AI_PROBE=1)');

  if (process.env.AI_PROBE !== '1') {
    console.log('     ignorée. `AI_PROBE=1 npm run check:provider` appelle chaque');
    console.log('     modèle déclaré pour vérifier qu\'il RÉPOND — un modèle retiré');
    console.log('     par le fournisseur ne se voit pas autrement qu\'à l\'usage.');
    return;
  }

  // Appel DIRECT au SDK du fournisseur, sans passer par `promptService`.
  //
  // Deux raisons. D'abord la justesse : on veut savoir si le MODÈLE répond, pas
  // si la pile applicative fonctionne — et `runPrompt` traverse quotas,
  // restrictions et relevé d'usage, donc Mongo, Redis et MinIO. Un contrôle de
  // pré-démarrage qui exige la base pour dire si un modèle existe n'est pas un
  // contrôle de pré-démarrage. Ensuite la simplicité : le service importe le
  // registre que ce script a déjà chargé, ce qui referme un cycle d'imports.
  const candidates = [
    ...new Set([
      ...Object.values(definition.models ?? {}),
      ...(definition.defaultFallbackModels ?? []),
    ]),
  ].filter(Boolean) as string[];

  const askOnce = async (model: string): Promise<string> => {
    if (definition.kind === 'gemini') {
      const { getGoogleGenAIClient } = await import('../config/google-genai.client');
      // Budget CONFORTABLE, et raisonnement coupé quand le modèle le permet.
      // À 8 tokens, un modèle qui réfléchit consomme tout et rend une réponse
      // vide : la sonde conclurait « indisponible » sur un modèle parfaitement
      // fonctionnel. On teste la DISPONIBILITÉ, pas le comportement de réflexion.
      const result = await getGoogleGenAIClient().models.generateContent({
        model,
        contents: [{ role: 'user', parts: [{ text: 'Répondre exactement: OK' }] }],
        config: {
          maxOutputTokens: 512,
          temperature: 0,
          ...buildGeminiThinkingConfig(model, 0),
        },
      });
      return result.text ?? '';
    }

    const { default: OpenAI } = await import('openai');
    const client = new OpenAI({
      apiKey: process.env[definition.apiKeyEnv] ?? '',
      ...(definition.baseUrl ? { baseURL: definition.baseUrl } : {}),
      maxRetries: 0,
      timeout: 30_000,
    });
    const completion = await client.chat.completions.create({
      model,
      messages: [{ role: 'user', content: 'Répondre exactement: OK' }],
      max_tokens: 8,
      temperature: 0,
      ...(definition.extraBody ?? {}),
    } as any);
    return completion.choices?.[0]?.message?.content ?? '';
  };

  for (const model of candidates) {
    const startedAt = Date.now();
    try {
      const answer = await askOnce(model);
      check(
        `${model} répond (${Date.now() - startedAt} ms)`,
        answer.trim().length > 0,
        'réponse vide — le modèle existe mais n\'a rien produit'
      );
    } catch (error: any) {
      const message = String(error?.message ?? error);
      const retired = /no longer available|not found|NOT_FOUND|404/i.test(message);
      check(
        `${model} répond`,
        false,
        retired
          ? `RETIRÉ ou inconnu de ce compte — ${message.slice(0, 200)}`
          : message.slice(0, 200)
      );
    }
  }
}

probeModels()
  .catch((error) => {
    failures += 1;
    console.error(`  ✗ sonde impossible — ${error?.message ?? error}`);
  })
  .then(() => {
    finish();
  });

function finish(): void {
console.log('');
if (failures > 0) {
  console.error(`Aiguillage${target ? ` vers ${target}` : ''} : ${failures} problème(s) bloquant(s).\n`);
  process.exit(1);
}
console.log(
  `Aiguillage${target ? ` vers ${target}` : ''} : cohérent${warnings > 0 ? ` (${warnings} avertissement(s))` : ''}.\n`
);
}
